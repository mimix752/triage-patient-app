import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import {
  createPatientRecord,
  createStaffNotificationRecord,
  createTriageCaseRecord,
  createTriageEventRecord,
  getCaseTimeline,
  getDashboardSummary,
  listDashboardCases,
  listRecentNotifications,
  markNotificationDelivered,
  seedDemoIfEmpty,
  updateCaseStatus,
} from "./db";
import {
  decodeDataUrl,
  extractIdentityFromTranscript,
  hashSensitiveValue,
  maskSocialSecurityNumber,
  mergeIdentityDrafts,
  normalizeDate,
  normalizeFreeText,
  normalizeSocialSecurityNumber,
} from "./patientIdentity";
import {
  computeTriageAssessment,
  guidedQuestions,
  triageProtocolSummary,
} from "./triage";
import { storagePut } from "./storage";

const intakeMethodSchema = z.enum(["ocr", "manuel", "vocal"]);

const identitySchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  dateOfBirth: z.string().default(""),
  socialSecurityNumber: z.string().default(""),
});

const assessmentSchema = z.object({
  chiefComplaint: z.string().min(3),
  symptomSummary: z.string().min(5),
  painLevel: z.number().min(0).max(10),
  canWalk: z.boolean(),
  hasBleeding: z.boolean(),
  hasSevereBleeding: z.boolean(),
  hasBreathingDifficulty: z.boolean(),
  hasChestPain: z.boolean(),
  hasNeurologicalDeficit: z.boolean(),
  hasLossOfConsciousness: z.boolean(),
  hasHighFever: z.boolean(),
  hasTrauma: z.boolean(),
  isPregnant: z.boolean(),
  oxygenSaturation: z.number().min(0).max(100).nullable().optional(),
  heartRate: z.number().min(0).max(250).nullable().optional(),
  respiratoryRate: z.number().min(0).max(120).nullable().optional(),
  systolicBloodPressure: z.number().min(0).max(300).nullable().optional(),
});

const createCaseSchema = z.object({
  intakeMethod: intakeMethodSchema,
  identity: identitySchema,
  identityImageDataUrl: z.string().optional(),
  voiceAudioDataUrl: z.string().optional(),
  preferredLanguage: z.string().default("fr"),
  mobileNumber: z.string().default(""),
  notes: z.string().default(""),
  assessment: assessmentSchema,
});

async function uploadDataUrl(dataUrl: string, prefix: string) {
  const decoded = decodeDataUrl(dataUrl);
  const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const { url } = await storagePut(
    `${prefix}/${randomSuffix}.${decoded.extension}`,
    decoded.buffer,
    decoded.mimeType,
  );
  return { url, mimeType: decoded.mimeType };
}

async function extractIdentityFromImage(imageUrl: string) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Vous extrayez des informations d’identité à partir d’une carte ou d’un document officiel. Répondez uniquement avec les champs demandés. Si une valeur est absente ou incertaine, retournez une chaîne vide.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extrais si possible le prénom, le nom, la date de naissance et le numéro de sécurité sociale ou identifiant national visible sur ce document. Normalise la date au format YYYY-MM-DD si possible.",
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "identity_card_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            dateOfBirth: { type: "string" },
            socialSecurityNumber: { type: "string" },
          },
          required: ["firstName", "lastName", "dateOfBirth", "socialSecurityNumber"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? {});
  const parsed = JSON.parse(text) as {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    socialSecurityNumber: string;
  };

  return {
    firstName: normalizeFreeText(parsed.firstName),
    lastName: normalizeFreeText(parsed.lastName),
    dateOfBirth: normalizeDate(parsed.dateOfBirth),
    socialSecurityNumber: normalizeSocialSecurityNumber(parsed.socialSecurityNumber),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  triage: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      await seedDemoIfEmpty(ctx.user.id);
      const [summary, cases, notifications] = await Promise.all([
        getDashboardSummary(),
        listDashboardCases(),
        listRecentNotifications(),
      ]);

      return {
        summary,
        cases,
        notifications,
        guidedQuestions,
        protocolSummary: triageProtocolSummary,
      };
    }),
    dashboard: protectedProcedure.query(async () => {
      const [summary, cases, notifications] = await Promise.all([
        getDashboardSummary(),
        listDashboardCases(),
        listRecentNotifications(),
      ]);

      return {
        summary,
        cases,
        notifications,
      };
    }),
    guidedQuestions: protectedProcedure.query(() => guidedQuestions),
    createCase: protectedProcedure
      .input(createCaseSchema)
      .mutation(async ({ ctx, input }) => {
        let identitySourceUrl = "";
        let voiceTranscript = "";
        let ocrDraft: z.infer<typeof identitySchema> | undefined;
        let vocalDraft: z.infer<typeof identitySchema> | undefined;

        if (input.identityImageDataUrl) {
          const uploadedImage = await uploadDataUrl(input.identityImageDataUrl, `triage/${ctx.user.id}/identity`);
          identitySourceUrl = uploadedImage.url;
          if (input.intakeMethod === "ocr") {
            ocrDraft = await extractIdentityFromImage(uploadedImage.url);
          }
        }

        if (input.voiceAudioDataUrl) {
          const uploadedAudio = await uploadDataUrl(input.voiceAudioDataUrl, `triage/${ctx.user.id}/voice`);
          const transcription = await transcribeAudio({
            audioUrl: uploadedAudio.url,
            language: input.preferredLanguage,
            prompt:
              "Transcrire fidèlement la voix d’un patient ou d’un agent d’accueil en contexte d’urgences. Identifier nom, prénom, date de naissance et numéro d’identité si dictés.",
          });

          if ("error" in transcription) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: transcription.error,
            });
          }

          voiceTranscript = transcription.text;
          if (input.intakeMethod === "vocal") {
            vocalDraft = extractIdentityFromTranscript(transcription.text);
          }
        }

        const mergedIdentity = mergeIdentityDrafts(
          input.intakeMethod === "manuel" ? input.identity : undefined,
          ocrDraft,
          vocalDraft,
          input.identity,
        );

        if (!mergedIdentity.firstName || !mergedIdentity.lastName || !mergedIdentity.dateOfBirth) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Les informations patient sont incomplètes. Veuillez vérifier le scan, la transcription ou compléter la saisie manuelle.",
          });
        }

        const normalizedSSN = normalizeSocialSecurityNumber(mergedIdentity.socialSecurityNumber);
        const assessment = computeTriageAssessment(input.assessment);

        const patient = await createPatientRecord({
          createdByUserId: ctx.user.id,
          intakeMethod: input.intakeMethod,
          firstName: mergedIdentity.firstName,
          lastName: mergedIdentity.lastName,
          dateOfBirth: mergedIdentity.dateOfBirth,
          socialSecurityNumberMasked: maskSocialSecurityNumber(normalizedSSN || "indisponible"),
          socialSecurityNumberHash: hashSensitiveValue(normalizedSSN || `${mergedIdentity.firstName}-${mergedIdentity.lastName}-${mergedIdentity.dateOfBirth}`),
          identitySourceUrl: identitySourceUrl || null,
          voiceTranscript: voiceTranscript || null,
          preferredLanguage: normalizeFreeText(input.preferredLanguage) || "fr",
          mobileNumber: normalizeFreeText(input.mobileNumber) || null,
          notes: normalizeFreeText(input.notes) || null,
        });

        const triageCase = await createTriageCaseRecord({
          patientId: patient.id,
          createdByUserId: ctx.user.id,
          chiefComplaint: normalizeFreeText(input.assessment.chiefComplaint),
          symptomSummary: normalizeFreeText(input.assessment.symptomSummary),
          painLevel: input.assessment.painLevel,
          canWalk: input.assessment.canWalk,
          hasBleeding: input.assessment.hasBleeding,
          hasSevereBleeding: input.assessment.hasSevereBleeding,
          hasBreathingDifficulty: input.assessment.hasBreathingDifficulty,
          hasChestPain: input.assessment.hasChestPain,
          hasNeurologicalDeficit: input.assessment.hasNeurologicalDeficit,
          hasLossOfConsciousness: input.assessment.hasLossOfConsciousness,
          hasHighFever: input.assessment.hasHighFever,
          hasTrauma: input.assessment.hasTrauma,
          isPregnant: input.assessment.isPregnant,
          oxygenSaturation: input.assessment.oxygenSaturation ?? null,
          heartRate: input.assessment.heartRate ?? null,
          respiratoryRate: input.assessment.respiratoryRate ?? null,
          systolicBloodPressure: input.assessment.systolicBloodPressure ?? null,
          priority: assessment.priority,
          status: "en_attente",
          targetWaitMinutes: assessment.targetWaitMinutes,
          waitingTimeMinutes: 0,
          queueRank: assessment.queueRank,
          rationaleJson: JSON.stringify(assessment.rationale),
          recommendedAction: assessment.recommendedAction,
          protocolReference: assessment.protocolReference,
          clinicianValidation: "En attente de validation médicale.",
        });

        await createTriageEventRecord({
          triageCaseId: triageCase.id,
          eventType: "creation",
          title: `Cas créé · ${assessment.label}`,
          description: `Nouveau patient enregistré via le canal ${input.intakeMethod}.`,
          eventPayload: JSON.stringify({
            intakeMethod: input.intakeMethod,
            rationale: assessment.rationale,
            targetWaitMinutes: assessment.targetWaitMinutes,
          }),
        });

        let notificationPreview: { severity: string; title: string; content: string } | null = null;

        if (assessment.severe) {
          const severity = assessment.priority === "urgence_vitale" ? "critical" : "urgent";
          const title =
            assessment.priority === "urgence_vitale"
              ? "Alerte triage critique"
              : "Nouveau cas urgent à évaluer";
          const content = `${patient.firstName} ${patient.lastName} · ${assessment.label} · ${input.assessment.chiefComplaint}`;

          const notification = await createStaffNotificationRecord({
            triageCaseId: triageCase.id,
            severity,
            title,
            content,
            delivered: false,
          });

          const delivered = await notifyOwner({
            title,
            content,
          }).catch(() => false);

          await markNotificationDelivered(notification.id, Boolean(delivered));

          await createTriageEventRecord({
            triageCaseId: triageCase.id,
            eventType: "notification",
            title,
            description: content,
            eventPayload: JSON.stringify({ delivered: Boolean(delivered) }),
          });

          notificationPreview = { severity, title, content };
        }

        return {
          patient,
          triageCase,
          assessment,
          voiceTranscript,
          notificationPreview,
        };
      }),
    caseTimeline: protectedProcedure
      .input(z.object({ triageCaseId: z.number().int().positive() }))
      .query(async ({ input }) => getCaseTimeline(input.triageCaseId)),
    updateStatus: adminProcedure
      .input(
        z.object({
          triageCaseId: z.number().int().positive(),
          status: z.enum(["en_attente", "en_cours", "oriente", "termine"]),
        }),
      )
      .mutation(async ({ input }) => {
        const updated = await updateCaseStatus(input.triageCaseId, input.status);
        await createTriageEventRecord({
          triageCaseId: input.triageCaseId,
          eventType: "status_update",
          title: "Statut mis à jour",
          description: `Le statut du dossier a été changé vers ${input.status}.`,
          eventPayload: JSON.stringify({ status: input.status }),
        });
        return updated;
      }),
  }),
});

export type AppRouter = typeof appRouter;
