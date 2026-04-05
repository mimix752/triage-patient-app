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
  createPatientFormLink,
  createPatientRecord,
  createStaffingSnapshot,
  createStaffNotificationRecord,
  createTriageCaseRecord,
  createTriageEventRecord,
  getCaseById,
  getCaseTimeline,
  getDashboardSummary,
  getLatestStaffingSnapshot,
  getPatientFormLinkByToken,
  listActivePatientsForStaff,
  listDashboardCases,
  listPatientFormLinks,
  listRecentNotifications,
  markNotificationDelivered,
  seedDemoIfEmpty,
  touchPatientFormLinkUsage,
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
  computeQueuePressureScore,
  computeResourceAwareTriageAssessment,
  createManualP1Assessment,
  guidedQuestions,
  triageProtocolSummary,
  type AiClinicalInsights,
} from "./triage";
import { storagePut } from "./storage";
import { resolveRequestPublicOrigin } from "../shared/publicOrigin";

const intakeMethodSchema = z.enum(["ocr", "manuel", "vocal"]);
const manualPrioritySchema = z.enum(["urgence_vitale", "urgence", "semi_urgence", "non_urgent"]);

const identitySchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  dateOfBirth: z.string().default(""),
  socialSecurityNumber: z.string().default(""),
});

const assessmentSchema = z.object({
  chiefComplaint: z.string().min(2),
  symptomSummary: z.string().min(3),
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

const staffingSchema = z.object({
  doctorsOnDuty: z.number().int().min(0).default(1),
  nursesOnDuty: z.number().int().min(0).default(1),
  availableDoctors: z.number().int().min(0).default(1),
  availableNurses: z.number().int().min(0).default(1),
  waitingPatients: z.number().int().min(0).default(0),
  activeCriticalPatients: z.number().int().min(0).default(0),
  notes: z.string().default(""),
});

const commonCaseSchema = z.object({
  intakeMethod: intakeMethodSchema,
  identity: identitySchema,
  identityImageDataUrl: z.string().optional(),
  voiceAudioDataUrl: z.string().optional(),
  voiceTranscriptText: z.string().default("").optional(),
  preferredLanguage: z.string().default("fr"),
  mobileNumber: z.string().default(""),
  notes: z.string().default(""),
  assessment: assessmentSchema,
});

const staffCaseSchema = commonCaseSchema.extend({
  staffing: staffingSchema.optional(),
  skipAiAnalysis: z.boolean().default(false),
  manualPriority: manualPrioritySchema.nullable().optional(),
  manualReason: z.string().default(""),
});

const patientCaseSchema = commonCaseSchema.extend({
  token: z.string().min(8),
});

const manualP1CaseSchema = z.object({
  intakeMethod: intakeMethodSchema.default("manuel"),
  identity: identitySchema.partial().default({}),
  identityImageDataUrl: z.string().optional(),
  voiceAudioDataUrl: z.string().optional(),
  preferredLanguage: z.string().default("fr"),
  mobileNumber: z.string().default(""),
  notes: z.string().default(""),
  staffing: staffingSchema.optional(),
  manualReason: z.string().min(3),
  chiefComplaint: z.string().default("Admission critique immédiate"),
  symptomSummary: z.string().default("Prise en charge manuelle P1 décidée par le personnel soignant avant collecte clinique complète."),
});

const liveTranscriptionSchema = z.object({
  audioDataUrl: z.string().min(20),
  currentTranscript: z.string().default(""),
  preferredLanguage: z.string().default("fr"),
});

const cameraFrameSchema = z.object({
  token: z.string().min(8).optional(),
  terminalLabel: z.string().min(2).default("Caméra patient"),
  preferredLanguage: z.string().default("fr"),
  imageDataUrl: z.string().min(20),
  identity: identitySchema.partial().default({}),
  mobileNumber: z.string().default(""),
  notes: z.string().default(""),
});

type StaffingRuntimeInput = {
  doctorsOnDuty: number;
  nursesOnDuty: number;
  availableDoctors: number;
  availableNurses: number;
  waitingPatients: number;
  activeCriticalPatients: number;
  notes?: string | null;
};

async function uploadDataUrl(dataUrl: string, prefix: string) {
  const decoded = decodeDataUrl(dataUrl);
  const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const { url } = await storagePut(`${prefix}/${randomSuffix}.${decoded.extension}`, decoded.buffer, decoded.mimeType);
  return { url, mimeType: decoded.mimeType };
}

export function shouldIgnoreLiveTranscriptionError(error: {
  code: string;
  details?: string;
}) {
  return (
    error.code === "TRANSCRIPTION_FAILED" &&
    (error.details?.includes("Invalid file format") ||
      error.details?.includes("audio/transcriptions") ||
      error.details?.includes("400 Bad Request"))
  );
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

async function inferClinicalInsights(params: {
  assessment: z.infer<typeof assessmentSchema>;
  preferredLanguage: string;
  staffing?: StaffingRuntimeInput | null;
}): Promise<AiClinicalInsights | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Vous êtes un assistant de structuration clinique pour un prototype de triage des urgences. Vous devez extraire des signaux utiles, proposer une priorité clinique prudente et résumer les points d’attention. Vous n’émettez jamais de diagnostic définitif.",
        },
        {
          role: "user",
          content: `Analyse ce cas de triage et retourne uniquement un JSON strict. Langue du patient: ${params.preferredLanguage}. Données cliniques: ${JSON.stringify(
            params.assessment,
          )}. Ressources du service: ${JSON.stringify(params.staffing ?? null)}.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clinical_triage_insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suspectedPriority: {
                type: "string",
                enum: ["urgence_vitale", "urgence", "semi_urgence", "non_urgent", ""],
              },
              clinicalSignals: {
                type: "array",
                items: { type: "string" },
              },
              riskFactors: {
                type: "array",
                items: { type: "string" },
              },
              suggestedQuestions: {
                type: "array",
                items: { type: "string" },
              },
              summary: { type: "string" },
            },
            required: ["suspectedPriority", "clinicalSignals", "riskFactors", "suggestedQuestions", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === "string" ? content : JSON.stringify(content ?? {});
    return JSON.parse(text) as AiClinicalInsights;
  } catch (error) {
    console.warn("[LLM] Clinical insight fallback used:", error);
    return null;
  }
}

async function buildIdentityAndTranscript(params: {
  intakeMethod: z.infer<typeof intakeMethodSchema>;
  identity: z.infer<typeof identitySchema>;
  identityImageDataUrl?: string;
  voiceAudioDataUrl?: string;
  voiceTranscriptText?: string;
  preferredLanguage: string;
  ownerPrefix: string;
}) {
  let identitySourceUrl = "";
  let voiceTranscript = normalizeFreeText(params.voiceTranscriptText ?? "") || "";
  let ocrDraft: z.infer<typeof identitySchema> | undefined;
  let vocalDraft: z.infer<typeof identitySchema> | undefined;

  if (params.intakeMethod === "vocal" && voiceTranscript) {
    vocalDraft = extractIdentityFromTranscript(voiceTranscript);
  }

  if (params.identityImageDataUrl) {
    const uploadedImage = await uploadDataUrl(params.identityImageDataUrl, `${params.ownerPrefix}/identity`);
    identitySourceUrl = uploadedImage.url;
    if (params.intakeMethod === "ocr") {
      ocrDraft = await extractIdentityFromImage(uploadedImage.url);
    }
  }

  if (params.voiceAudioDataUrl) {
    const uploadedAudio = await uploadDataUrl(params.voiceAudioDataUrl, `${params.ownerPrefix}/voice`);
    const transcription = await transcribeAudio({
      audioUrl: uploadedAudio.url,
      language: params.preferredLanguage,
      prompt:
        "Transcrire fidèlement la voix d’un patient ou d’un agent d’accueil en contexte d’urgences. Identifier nom, prénom, date de naissance et numéro d’identité si dictés.",
    });

    if ("error" in transcription) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: transcription.error,
      });
    }

    voiceTranscript = normalizeFreeText([voiceTranscript, transcription.text].filter(Boolean).join(" ")) || voiceTranscript;
    if (params.intakeMethod === "vocal") {
      vocalDraft = extractIdentityFromTranscript(voiceTranscript);
    }
  }

  const mergedIdentity = mergeIdentityDrafts(
    params.intakeMethod === "manuel" ? params.identity : undefined,
    ocrDraft,
    vocalDraft,
    params.identity,
  );

  return {
    mergedIdentity,
    identitySourceUrl,
    voiceTranscript,
  };
}

async function notifyIfSevere(params: {
  triageCaseId: number;
  patientDisplayName: string;
  chiefComplaint: string;
  priority: "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent";
}) {
  if (params.priority !== "urgence_vitale" && params.priority !== "urgence") {
    return null;
  }

  const severity = params.priority === "urgence_vitale" ? "critical" : "urgent";
  const title = params.priority === "urgence_vitale" ? "Alerte triage critique" : "Nouveau cas urgent à évaluer";
  const content = `${params.patientDisplayName} · ${params.chiefComplaint}`;

  const notification = await createStaffNotificationRecord({
    triageCaseId: params.triageCaseId,
    severity,
    title,
    content,
    delivered: false,
  });

  const delivered = await notifyOwner({ title, content }).catch(() => false);
  await markNotificationDelivered(notification.id, Boolean(delivered));

  await createTriageEventRecord({
    triageCaseId: params.triageCaseId,
    eventType: "notification",
    title,
    description: content,
    eventPayload: JSON.stringify({ delivered: Boolean(delivered), severity }),
  });

  return { severity, title, content, delivered: Boolean(delivered) };
}

const cameraAlertCooldown = new Map<string, number>();

function isCameraAlertCoolingDown(key: string, cooldownMs = 120_000) {
  const now = Date.now();
  const lastDetectionAt = cameraAlertCooldown.get(key) ?? 0;
  if (now - lastDetectionAt < cooldownMs) {
    return true;
  }
  cameraAlertCooldown.set(key, now);
  return false;
}

type CriticalVisualAnalysis = {
  critical: boolean;
  visiblePersonPresent: boolean;
  fainting: boolean;
  severeHemorrhage: boolean;
  abnormalPosture: boolean;
  respiratoryDistress: boolean;
  confidence: number;
  summary: string;
  recommendedPriority: "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent";
  recommendedAction: string;
};

async function analyzeCriticalVisualSignals(params: {
  imageDataUrl: string;
  preferredLanguage: string;
}) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Vous êtes un assistant de surveillance clinique visuelle pour un service d’urgences. Vous ne posez jamais de diagnostic. Vous repérez uniquement des signes visuels potentiellement critiques visibles sur l’image et répondez en JSON strict.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Analyse cette image de caméra patient. Langue préférée: ${params.preferredLanguage}. Détecte uniquement des signes visuels immédiatement observables parmi: évanouissement/perte de tonus, hémorragie sévère visible, posture anormale inquiétante, détresse respiratoire apparente. Si l’image n’est pas exploitable ou qu’aucune personne n’est visible, indique-le prudemment.`,
          },
          {
            type: "image_url",
            image_url: {
              url: params.imageDataUrl,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "critical_visual_triage",
        strict: true,
        schema: {
          type: "object",
          properties: {
            critical: { type: "boolean" },
            visiblePersonPresent: { type: "boolean" },
            fainting: { type: "boolean" },
            severeHemorrhage: { type: "boolean" },
            abnormalPosture: { type: "boolean" },
            respiratoryDistress: { type: "boolean" },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            summary: { type: "string" },
            recommendedPriority: {
              type: "string",
              enum: ["urgence_vitale", "urgence", "semi_urgence", "non_urgent"],
            },
            recommendedAction: { type: "string" },
          },
          required: [
            "critical",
            "visiblePersonPresent",
            "fainting",
            "severeHemorrhage",
            "abnormalPosture",
            "respiratoryDistress",
            "confidence",
            "summary",
            "recommendedPriority",
            "recommendedAction",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? {});
  return JSON.parse(text) as CriticalVisualAnalysis;
}

function buildAssessmentFromVisualAnalysis(analysis: CriticalVisualAnalysis): z.infer<typeof assessmentSchema> {
  const criticalComplaint = [
    analysis.fainting ? "malaise ou perte de tonus" : "",
    analysis.severeHemorrhage ? "hémorragie visible" : "",
    analysis.abnormalPosture ? "posture anormale" : "",
    analysis.respiratoryDistress ? "détresse respiratoire" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    chiefComplaint: criticalComplaint || "Alerte visuelle critique détectée par caméra",
    symptomSummary: analysis.summary || "Détection visuelle automatisée en attente de validation humaine.",
    painLevel: analysis.severeHemorrhage || analysis.respiratoryDistress ? 9 : 7,
    canWalk: !(analysis.fainting || analysis.abnormalPosture),
    hasBleeding: analysis.severeHemorrhage,
    hasSevereBleeding: analysis.severeHemorrhage,
    hasBreathingDifficulty: analysis.respiratoryDistress,
    hasChestPain: false,
    hasNeurologicalDeficit: analysis.abnormalPosture,
    hasLossOfConsciousness: analysis.fainting,
    hasHighFever: false,
    hasTrauma: analysis.abnormalPosture || analysis.severeHemorrhage,
    isPregnant: false,
    oxygenSaturation: null,
    heartRate: null,
    respiratoryRate: analysis.respiratoryDistress ? 32 : null,
    systolicBloodPressure: null,
  };
}

async function persistCase(params: {
  createdByUserId: number | null;
  formLinkId?: number | null;
  intakeSource: "staff_full" | "patient_qr";
  payload: z.infer<typeof commonCaseSchema>;
  staffing?: StaffingRuntimeInput | null;
  aiInsights?: AiClinicalInsights | null;
  manualPriority?: "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent" | null;
  manualReason?: string;
  skipAiAnalysis?: boolean;
  ownerPrefix: string;
}) {
  const { mergedIdentity, identitySourceUrl, voiceTranscript } = await buildIdentityAndTranscript({
    intakeMethod: params.payload.intakeMethod,
    identity: params.payload.identity,
    identityImageDataUrl: params.payload.identityImageDataUrl,
    voiceAudioDataUrl: params.payload.voiceAudioDataUrl,
    voiceTranscriptText: params.payload.voiceTranscriptText,
    preferredLanguage: params.payload.preferredLanguage,
    ownerPrefix: params.ownerPrefix,
  });

  const isManualP1 = params.manualPriority === "urgence_vitale";
  const safeIdentity = {
    firstName: mergedIdentity.firstName || (isManualP1 ? "Patient" : ""),
    lastName: mergedIdentity.lastName || (isManualP1 ? "Critique" : ""),
    dateOfBirth: mergedIdentity.dateOfBirth || (isManualP1 ? "1900-01-01" : ""),
    socialSecurityNumber: mergedIdentity.socialSecurityNumber,
  };

  if (!safeIdentity.firstName || !safeIdentity.lastName || !safeIdentity.dateOfBirth) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Les informations patient sont incomplètes. Veuillez vérifier le scan, la transcription ou compléter la saisie manuelle.",
    });
  }

  const activeStaffing = params.staffing ?? (await getLatestStaffingSnapshot()) ?? null;
  const normalizedSSN = normalizeSocialSecurityNumber(safeIdentity.socialSecurityNumber);

  const assessment =
    params.manualPriority === "urgence_vitale"
      ? createManualP1Assessment(params.manualReason ?? "", activeStaffing)
      : computeResourceAwareTriageAssessment(params.payload.assessment, {
          staffing: activeStaffing,
          aiInsights: params.aiInsights ?? null,
          manualPriority: params.manualPriority ?? null,
          manualReason: params.manualReason ?? "",
          skipAiAnalysis: params.skipAiAnalysis,
        });

  const staffingSnapshot = activeStaffing
    ? await createStaffingSnapshot({
        createdByUserId: params.createdByUserId,
        doctorsOnDuty: activeStaffing.doctorsOnDuty,
        nursesOnDuty: activeStaffing.nursesOnDuty,
        availableDoctors: activeStaffing.availableDoctors,
        availableNurses: activeStaffing.availableNurses,
        waitingPatients: activeStaffing.waitingPatients,
        activeCriticalPatients: activeStaffing.activeCriticalPatients,
        occupancyPressureScore: computeQueuePressureScore(activeStaffing),
        notes: normalizeFreeText(activeStaffing.notes ?? "") || null,
      })
    : null;

  const patient = await createPatientRecord({
    createdByUserId: params.createdByUserId,
    formLinkId: params.formLinkId ?? null,
    intakeMethod: params.payload.intakeMethod,
    intakeSource: params.intakeSource,
    firstName: safeIdentity.firstName,
    lastName: safeIdentity.lastName,
    dateOfBirth: safeIdentity.dateOfBirth,
    socialSecurityNumberMasked: maskSocialSecurityNumber(normalizedSSN || "indisponible"),
    socialSecurityNumberHash: hashSensitiveValue(
      normalizedSSN || `${safeIdentity.firstName}-${safeIdentity.lastName}-${safeIdentity.dateOfBirth}`,
    ),
    identitySourceUrl: identitySourceUrl || null,
    voiceTranscript: voiceTranscript || null,
    preferredLanguage: normalizeFreeText(params.payload.preferredLanguage) || "fr",
    mobileNumber: normalizeFreeText(params.payload.mobileNumber) || null,
    notes: normalizeFreeText(params.payload.notes) || null,
  });

  const triageCase = await createTriageCaseRecord({
    patientId: patient.id,
    createdByUserId: params.createdByUserId,
    staffingSnapshotId: staffingSnapshot?.id ?? null,
    chiefComplaint: normalizeFreeText(params.payload.assessment.chiefComplaint),
    symptomSummary: normalizeFreeText(params.payload.assessment.symptomSummary),
    painLevel: params.payload.assessment.painLevel,
    canWalk: params.payload.assessment.canWalk,
    hasBleeding: params.payload.assessment.hasBleeding,
    hasSevereBleeding: params.payload.assessment.hasSevereBleeding,
    hasBreathingDifficulty: params.payload.assessment.hasBreathingDifficulty,
    hasChestPain: params.payload.assessment.hasChestPain,
    hasNeurologicalDeficit: params.payload.assessment.hasNeurologicalDeficit,
    hasLossOfConsciousness: params.payload.assessment.hasLossOfConsciousness,
    hasHighFever: params.payload.assessment.hasHighFever,
    hasTrauma: params.payload.assessment.hasTrauma,
    isPregnant: params.payload.assessment.isPregnant,
    oxygenSaturation: params.payload.assessment.oxygenSaturation ?? null,
    heartRate: params.payload.assessment.heartRate ?? null,
    respiratoryRate: params.payload.assessment.respiratoryRate ?? null,
    systolicBloodPressure: params.payload.assessment.systolicBloodPressure ?? null,
    priority: assessment.priority,
    aiRecommendedPriority: assessment.aiRecommendedPriority,
    status: "en_attente",
    entryMode: assessment.entryMode,
    manualPriorityOverride: assessment.manualPriorityOverride,
    manualPriorityReason: assessment.manualPriorityReason,
    skipAiAnalysis: assessment.skipAiAnalysis,
    queuePressureScore: assessment.queuePressureScore,
    targetWaitMinutes: assessment.targetWaitMinutes,
    waitingTimeMinutes: 0,
    queueRank: assessment.queueRank,
    rationaleJson: JSON.stringify(assessment.rationale),
    aiSummaryJson: assessment.aiSummary ? JSON.stringify(assessment.aiSummary) : null,
    recommendedAction: assessment.recommendedAction,
    protocolReference: assessment.protocolReference,
    clinicianValidation: assessment.manualPriorityOverride
      ? "Priorité imposée ou confirmée par le personnel soignant."
      : "En attente de validation médicale.",
  });

  await createTriageEventRecord({
    triageCaseId: triageCase.id,
    eventType: "creation",
    title: `Cas créé · ${assessment.label}`,
    description:
      params.intakeSource === "patient_qr"
        ? "Nouveau patient enregistré via le formulaire public accessible par QR code."
        : `Nouveau patient enregistré via le canal ${params.payload.intakeMethod}.`,
    eventPayload: JSON.stringify({
      intakeMethod: params.payload.intakeMethod,
      intakeSource: params.intakeSource,
      rationale: assessment.rationale,
      targetWaitMinutes: assessment.targetWaitMinutes,
      queuePressureScore: assessment.queuePressureScore,
    }),
  });

  if (assessment.manualPriorityOverride) {
    await createTriageEventRecord({
      triageCaseId: triageCase.id,
      eventType: "manual_override",
      title: "Priorité imposée manuellement",
      description: assessment.manualPriorityReason || "Override manuel par le personnel soignant.",
      eventPayload: JSON.stringify({
        priority: assessment.priority,
        entryMode: assessment.entryMode,
      }),
    });
  }

  const notificationPreview = await notifyIfSevere({
    triageCaseId: triageCase.id,
    patientDisplayName: `${patient.firstName} ${patient.lastName}`,
    chiefComplaint: params.payload.assessment.chiefComplaint,
    priority: assessment.priority,
  });

  return {
    patient,
    triageCase,
    assessment,
    voiceTranscript,
    notificationPreview,
    staffingSnapshot,
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
    staffBootstrap: protectedProcedure.query(async ({ ctx }) => {
      await seedDemoIfEmpty(ctx.user.id);
      const [summary, cases, notifications, staffing, formLinks, activePatients] = await Promise.all([
        getDashboardSummary(),
        listDashboardCases(),
        listRecentNotifications(),
        getLatestStaffingSnapshot(),
        listPatientFormLinks(),
        listActivePatientsForStaff(),
      ]);

      return {
        mode: "staff",
        summary,
        staffing,
        cases,
        notifications,
        formLinks,
        activePatients,
        guidedQuestions,
        protocolSummary: triageProtocolSummary,
      };
    }),
    dashboard: protectedProcedure.query(async () => {
      const [summary, cases, notifications, staffing, formLinks, activePatients] = await Promise.all([
        getDashboardSummary(),
        listDashboardCases(),
        listRecentNotifications(),
        getLatestStaffingSnapshot(),
        listPatientFormLinks(),
        listActivePatientsForStaff(),
      ]);

      return {
        summary,
        staffing,
        notifications,
        cases,
        formLinks,
        activePatients,
      };
    }),
    guidedQuestions: publicProcedure.query(() => guidedQuestions),
    publicPatientEntry: publicProcedure.query(async ({ ctx }) => {
      const now = Date.now();
      const links = await listPatientFormLinks();
      const activeLink = links.find((link) => {
        const expiresAt = link.expiresAt ? new Date(link.expiresAt).getTime() : null;
        return link.isActive && (!expiresAt || expiresAt > now);
      });
      const publicOrigin = resolveRequestPublicOrigin(ctx.req.headers);

      if (activeLink) {
        const patientPath = `/patient/${activeLink.token}`;
        return {
          link: activeLink,
          patientPath,
          patientUrl: publicOrigin ? `${publicOrigin}${patientPath}` : "",
        };
      }

      const token = crypto.randomUUID().replace(/-/g, "");
      const link = await createPatientFormLink({
        createdByUserId: null,
        label: "Accès patient direct",
        token,
        isActive: true,
        expiresAt: null,
      });
      const patientPath = `/patient/${token}`;

      return {
        link,
        patientPath,
        patientUrl: publicOrigin ? `${publicOrigin}${patientPath}` : "",
      };
    }),
    transcribeVoiceLive: publicProcedure

      .input(liveTranscriptionSchema)
      .mutation(async ({ input }) => {
        const uploadedAudio = await uploadDataUrl(input.audioDataUrl, `triage/live-transcription/${Date.now()}`);
        const transcription = await transcribeAudio({
          audioUrl: uploadedAudio.url,
          language: input.preferredLanguage,
          prompt:
            "Transcrire fidèlement une saisie vocale de triage aux urgences. Préserver les noms, prénoms, dates, numéros d’identité et symptômes s’ils sont dictés.",
        });

        if ("error" in transcription) {
          const normalizedCurrentTranscript = normalizeFreeText(input.currentTranscript) || "";
          if (shouldIgnoreLiveTranscriptionError(transcription)) {
            return {
              transcriptChunk: "",
              mergedTranscript: normalizedCurrentTranscript,
              detectedLanguage: input.preferredLanguage,
              identityDraft: extractIdentityFromTranscript(normalizedCurrentTranscript),
            };
          }

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: transcription.error,
          });
        }

        const transcriptChunk = normalizeFreeText(transcription.text) || "";
        const mergedTranscript = normalizeFreeText(
          [input.currentTranscript, transcriptChunk].filter(Boolean).join(" "),
        ) || transcriptChunk;

        return {
          transcriptChunk,
          mergedTranscript,
          detectedLanguage: transcription.language || input.preferredLanguage,
          identityDraft: extractIdentityFromTranscript(mergedTranscript),
        };
      }),
    analyzeCameraFrame: publicProcedure
      .input(cameraFrameSchema)
      .mutation(async ({ input }) => {
        const uploadedFrame = await uploadDataUrl(input.imageDataUrl, `triage/camera-frame/${Date.now()}`);
        const analysis = await analyzeCriticalVisualSignals({
          imageDataUrl: uploadedFrame.url,
          preferredLanguage: input.preferredLanguage,
        });

        if (!analysis.visiblePersonPresent) {
          return {
            detected: false,
            critical: false,
            caseCreated: false,
            alertSuppressed: false,
            recommendedOrientation: null,
            analysis,
          };
        }

        const alertKey = [
          input.token || "public",
          input.terminalLabel,
          analysis.fainting ? "fainting" : "",
          analysis.severeHemorrhage ? "hemorrhage" : "",
          analysis.abnormalPosture ? "posture" : "",
          analysis.respiratoryDistress ? "respiratory" : "",
        ]
          .filter(Boolean)
          .join(":");

        if (!analysis.critical || isCameraAlertCoolingDown(alertKey)) {
          return {
            detected: true,
            critical: analysis.critical,
            caseCreated: false,
            alertSuppressed: analysis.critical,
            recommendedOrientation: analysis.critical ? "salle de réanimation" : null,
            analysis,
          };
        }

        const link = input.token ? await getPatientFormLinkByToken(input.token) : null;
        if (input.token && !link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Le lien patient associé à la caméra n’est plus disponible.",
          });
        }
        if (link) {
          await touchPatientFormLinkUsage(link.id);
        }

        const staffing = await getLatestStaffingSnapshot();
        const caseResult = await persistCase({
          createdByUserId: null,
          formLinkId: link?.id ?? null,
          intakeSource: "patient_qr",
          payload: {
            intakeMethod: "manuel",
            identity: {
              firstName: input.identity.firstName ?? "",
              lastName: input.identity.lastName ?? "",
              dateOfBirth: input.identity.dateOfBirth ?? "",
              socialSecurityNumber: input.identity.socialSecurityNumber ?? "",
            },
            preferredLanguage: input.preferredLanguage,
            mobileNumber: input.mobileNumber,
            notes:
              normalizeFreeText(
                [
                  input.notes,
                  `Détection caméra ${input.terminalLabel}. ${analysis.summary}`,
                ]
                  .filter(Boolean)
                  .join(" "),
              ) || "",
            assessment: buildAssessmentFromVisualAnalysis(analysis),
          },
          staffing,
          aiInsights: {
            suspectedPriority: "urgence_vitale",
            clinicalSignals: [
              analysis.fainting ? "évanouissement détecté" : "",
              analysis.severeHemorrhage ? "hémorragie sévère visible" : "",
              analysis.abnormalPosture ? "posture anormale" : "",
              analysis.respiratoryDistress ? "détresse respiratoire" : "",
            ].filter(Boolean),
            riskFactors: ["détection visuelle automatisée", "validation clinique immédiate requise"],
            suggestedQuestions: [
              "Confirmer l’état de conscience.",
              "Vérifier la perméabilité des voies aériennes et la respiration.",
              "Contrôler immédiatement tout saignement extériorisé.",
            ],
            summary: analysis.summary,
          },
          manualPriority: "urgence_vitale",
          manualReason: `Alerte critique caméra · ${input.terminalLabel} · orientation immédiate en salle de réanimation.`,
          skipAiAnalysis: true,
          ownerPrefix: `triage/camera/${input.token ?? "public"}`,
        });

        await createTriageEventRecord({
          triageCaseId: caseResult.triageCase.id,
          eventType: "note",
          title: "Détection critique caméra",
          description: `Alerte visuelle automatisée depuis ${input.terminalLabel} avec orientation recommandée en salle de réanimation.`,
          eventPayload: JSON.stringify({
            terminalLabel: input.terminalLabel,
            frameUrl: uploadedFrame.url,
            analysis,
            recommendedOrientation: "salle_de_reanimation",
          }),
        });

        return {
          detected: true,
          critical: true,
          caseCreated: true,
          alertSuppressed: false,
          recommendedOrientation: "salle de réanimation",
          analysis,
          triageCaseId: caseResult.triageCase.id,
          priority: caseResult.assessment.priority,
          notificationPreview: caseResult.notificationPreview,
        };
      }),
    createFormLink: protectedProcedure
      .input(
        z.object({
          label: z.string().min(2),
          origin: z.string().url(),
          expiresAt: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const token = crypto.randomUUID().replace(/-/g, "");
        const link = await createPatientFormLink({
          createdByUserId: ctx.user.id,
          label: normalizeFreeText(input.label),
          token,
          isActive: true,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });

        return {
          link,
          patientPath: `/patient/${token}`,
          patientUrl: `${input.origin.replace(/\/$/, "")}/patient/${token}`,
        };
      }),
    updateStaffing: protectedProcedure
      .input(staffingSchema)
      .mutation(async ({ ctx, input }) => {
        const snapshot = await createStaffingSnapshot({
          createdByUserId: ctx.user.id,
          doctorsOnDuty: input.doctorsOnDuty,
          nursesOnDuty: input.nursesOnDuty,
          availableDoctors: input.availableDoctors,
          availableNurses: input.availableNurses,
          waitingPatients: input.waitingPatients,
          activeCriticalPatients: input.activeCriticalPatients,
          occupancyPressureScore: computeQueuePressureScore(input),
          notes: normalizeFreeText(input.notes) || null,
        });

        return snapshot;
      }),
    createStaffCase: protectedProcedure
      .input(staffCaseSchema)
      .mutation(async ({ ctx, input }) => {
        const aiInsights = input.skipAiAnalysis
          ? null
          : await inferClinicalInsights({
              assessment: input.assessment,
              preferredLanguage: input.preferredLanguage,
              staffing: input.staffing ?? null,
            });

        return persistCase({
          createdByUserId: ctx.user.id,
          intakeSource: "staff_full",
          payload: input,
          staffing: input.staffing ?? null,
          aiInsights,
          manualPriority: input.manualPriority ?? null,
          manualReason: input.manualReason,
          skipAiAnalysis: input.skipAiAnalysis,
          ownerPrefix: `triage/${ctx.user.id}`,
        });
      }),
    createManualP1Case: protectedProcedure
      .input(manualP1CaseSchema)
      .mutation(async ({ ctx, input }) => {
        return persistCase({
          createdByUserId: ctx.user.id,
          intakeSource: "staff_full",
          payload: {
            intakeMethod: input.intakeMethod,
            identity: {
              firstName: input.identity.firstName ?? "",
              lastName: input.identity.lastName ?? "",
              dateOfBirth: input.identity.dateOfBirth ?? "",
              socialSecurityNumber: input.identity.socialSecurityNumber ?? "",
            },
            identityImageDataUrl: input.identityImageDataUrl,
            voiceAudioDataUrl: input.voiceAudioDataUrl,
            preferredLanguage: input.preferredLanguage,
            mobileNumber: input.mobileNumber,
            notes: input.notes,
            assessment: {
              chiefComplaint: input.chiefComplaint,
              symptomSummary: input.symptomSummary,
              painLevel: 10,
              canWalk: false,
              hasBleeding: false,
              hasSevereBleeding: false,
              hasBreathingDifficulty: true,
              hasChestPain: false,
              hasNeurologicalDeficit: false,
              hasLossOfConsciousness: true,
              hasHighFever: false,
              hasTrauma: false,
              isPregnant: false,
              oxygenSaturation: null,
              heartRate: null,
              respiratoryRate: null,
              systolicBloodPressure: null,
            },
          },
          staffing: input.staffing ?? null,
          manualPriority: "urgence_vitale",
          manualReason: input.manualReason,
          skipAiAnalysis: true,
          ownerPrefix: `triage/${ctx.user.id}`,
        });
      }),
    patientFormBootstrap: publicProcedure
      .input(z.object({ token: z.string().min(8) }))
      .query(async ({ input }) => {
        const link = await getPatientFormLinkByToken(input.token);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Le lien patient n’est plus disponible.",
          });
        }

        return {
          mode: "patient",
          link: {
            id: link.id,
            label: link.label,
            token: link.token,
            expiresAt: link.expiresAt,
          },
          guidedQuestions,
          protocolSummary: {
            ...triageProtocolSummary,
            description:
              "Le formulaire patient permet une pré-collecte des informations. La validation finale reste réalisée par le personnel soignant.",
          },
        };
      }),
    submitPatientCase: publicProcedure
      .input(patientCaseSchema)
      .mutation(async ({ input }) => {
        const link = await getPatientFormLinkByToken(input.token);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Le lien patient n’est plus disponible.",
          });
        }

        await touchPatientFormLinkUsage(link.id);

        const staffing = await getLatestStaffingSnapshot();
        const aiInsights = await inferClinicalInsights({
          assessment: input.assessment,
          preferredLanguage: input.preferredLanguage,
          staffing,
        });

        return persistCase({
          createdByUserId: null,
          formLinkId: link.id,
          intakeSource: "patient_qr",
          payload: input,
          staffing,
          aiInsights,
          skipAiAnalysis: false,
          ownerPrefix: `triage/public/${link.token}`,
        });
      }),
    caseDetail: protectedProcedure
      .input(z.object({ triageCaseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const triageCase = await getCaseById(input.triageCaseId);
        if (!triageCase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Le dossier patient demandé est introuvable.",
          });
        }

        return triageCase;
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
