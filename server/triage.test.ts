import { describe, expect, it } from "vitest";
import {
  decodeDataUrl,
  extractIdentityFromTranscript,
  hashSensitiveValue,
  maskSocialSecurityNumber,
  mergeIdentityDrafts,
  normalizeDate,
} from "./patientIdentity";
import {
  computeQueuePressureScore,
  computeResourceAwareTriageAssessment,
  computeTriageAssessment,
  createManualP1Assessment,
} from "./triage";
import { shouldIgnoreLiveTranscriptionError } from "./routers";
import {
  isAuthorizedStaffAccess,
  normalizeEmail as normalizeAccessEmail,
  pickActivePatientEntryLink,
} from "../shared/accessControl";
import { countPendingTreatmentCases, isCasePendingTreatment, triageStatusLabels } from "../shared/caseStatus";

describe("computeTriageAssessment", () => {
  it("classe un patient critique en urgence vitale en présence de signes vitaux instables", () => {
    const result = computeTriageAssessment({
      chiefComplaint: "Malaise sévère",
      symptomSummary: "Perte de connaissance et détresse respiratoire.",
      painLevel: 3,
      canWalk: false,
      hasBleeding: false,
      hasSevereBleeding: false,
      hasBreathingDifficulty: true,
      hasChestPain: false,
      hasNeurologicalDeficit: true,
      hasLossOfConsciousness: true,
      hasHighFever: false,
      hasTrauma: false,
      isPregnant: false,
      oxygenSaturation: 88,
      heartRate: 135,
      respiratoryRate: 31,
      systolicBloodPressure: 85,
    });

    expect(result.priority).toBe("urgence_vitale");
    expect(result.targetWaitMinutes).toBe(0);
    expect(result.severe).toBe(true);
    expect(result.rationale.join(" ")).toContain("Altération majeure");
  });

  it("classe un patient douloureux thoracique en urgence", () => {
    const result = computeTriageAssessment({
      chiefComplaint: "Douleur thoracique",
      symptomSummary: "Oppression thoracique depuis 30 minutes.",
      painLevel: 8,
      canWalk: true,
      hasBleeding: false,
      hasSevereBleeding: false,
      hasBreathingDifficulty: false,
      hasChestPain: true,
      hasNeurologicalDeficit: false,
      hasLossOfConsciousness: false,
      hasHighFever: false,
      hasTrauma: false,
      isPregnant: false,
      oxygenSaturation: 98,
      heartRate: 92,
      respiratoryRate: 18,
      systolicBloodPressure: 123,
    });

    expect(result.priority).toBe("urgence");
    expect(result.targetWaitMinutes).toBe(15);
    expect(result.protocolReference).toContain("ESI niveau 2");
  });

  it("classe une suspicion de fracture en semi-urgence", () => {
    const result = computeTriageAssessment({
      chiefComplaint: "Fracture du poignet",
      symptomSummary: "Douleur et gonflement après chute.",
      painLevel: 5,
      canWalk: true,
      hasBleeding: false,
      hasSevereBleeding: false,
      hasBreathingDifficulty: false,
      hasChestPain: false,
      hasNeurologicalDeficit: false,
      hasLossOfConsciousness: false,
      hasHighFever: false,
      hasTrauma: true,
      isPregnant: false,
      oxygenSaturation: 99,
      heartRate: 81,
      respiratoryRate: 16,
      systolicBloodPressure: 118,
    });

    expect(result.priority).toBe("semi_urgence");
    expect(result.targetWaitMinutes).toBe(60);
  });

  it("classe un cas simple en non urgent", () => {
    const result = computeTriageAssessment({
      chiefComplaint: "Renouvellement d’ordonnance",
      symptomSummary: "Demande administrative sans symptôme aigu.",
      painLevel: 0,
      canWalk: true,
      hasBleeding: false,
      hasSevereBleeding: false,
      hasBreathingDifficulty: false,
      hasChestPain: false,
      hasNeurologicalDeficit: false,
      hasLossOfConsciousness: false,
      hasHighFever: false,
      hasTrauma: false,
      isPregnant: false,
      oxygenSaturation: 99,
      heartRate: 72,
      respiratoryRate: 14,
      systolicBloodPressure: 120,
    });

    expect(result.priority).toBe("non_urgent");
    expect(result.queueRank).toBe(4);
    expect(result.severe).toBe(false);
  });
});

describe("resource-aware triage", () => {
  it("augmente la priorité d’un cas non urgent lorsque la pression opérationnelle devient critique", () => {
    const result = computeResourceAwareTriageAssessment(
      {
        chiefComplaint: "Demande de renouvellement",
        symptomSummary: "Aucun signe aigu immédiat.",
        painLevel: 1,
        canWalk: true,
        hasBleeding: false,
        hasSevereBleeding: false,
        hasBreathingDifficulty: false,
        hasChestPain: false,
        hasNeurologicalDeficit: false,
        hasLossOfConsciousness: false,
        hasHighFever: false,
        hasTrauma: false,
        isPregnant: false,
        oxygenSaturation: 99,
        heartRate: 72,
        respiratoryRate: 15,
        systolicBloodPressure: 121,
      },
      {
        staffing: {
          doctorsOnDuty: 2,
          nursesOnDuty: 3,
          availableDoctors: 0,
          availableNurses: 1,
          waitingPatients: 18,
          activeCriticalPatients: 4,
          notes: "Tension extrême du service",
        },
      },
    );

    expect(computeQueuePressureScore({
      doctorsOnDuty: 2,
      nursesOnDuty: 3,
      availableDoctors: 0,
      availableNurses: 1,
      waitingPatients: 18,
      activeCriticalPatients: 4,
      notes: "Tension extrême du service",
    })).toBeGreaterThanOrEqual(16);
    expect(result.priority).toBe("semi_urgence");
    expect(result.queueRank).toBeLessThanOrEqual(3);
    expect(result.rationale.join(" ")).toContain("charge opérationnelle du service");
  });

  it("préserve un override manuel P1 avec justification clinique", () => {
    const result = computeResourceAwareTriageAssessment(
      {
        chiefComplaint: "Douleur abdominale",
        symptomSummary: "Patient pâle, aggravation rapide observée à l’accueil.",
        painLevel: 6,
        canWalk: false,
        hasBleeding: false,
        hasSevereBleeding: false,
        hasBreathingDifficulty: false,
        hasChestPain: false,
        hasNeurologicalDeficit: false,
        hasLossOfConsciousness: false,
        hasHighFever: false,
        hasTrauma: false,
        isPregnant: false,
        oxygenSaturation: 97,
        heartRate: 108,
        respiratoryRate: 20,
        systolicBloodPressure: 110,
      },
      {
        manualPriority: "urgence_vitale",
        manualReason: "Décision infirmière immédiate avant bilan complet.",
      },
    );

    expect(result.priority).toBe("urgence_vitale");
    expect(result.entryMode).toBe("manual_p1");
    expect(result.manualPriorityOverride).toBe(true);
    expect(result.manualPriorityReason).toContain("Décision infirmière immédiate");
  });

  it("crée une évaluation P1 minimale cohérente pour une alerte critique immédiate", () => {
    const result = createManualP1Assessment("Effondrement observé en zone d’attente.");

    expect(result.priority).toBe("urgence_vitale");
    expect(result.queueRank).toBe(1);
    expect(result.targetWaitMinutes).toBe(0);
    expect(result.aiSummary?.summary).toContain("priorité vitale");
  });
});

describe("live transcription fallback", () => {
  it("ignore les fragments live invalides renvoyés par le service de transcription", () => {
    expect(
      shouldIgnoreLiveTranscriptionError({
        code: "TRANSCRIPTION_FAILED",
        details: "400 Bad Request: Invalid file format. Supported formats: ['webm']",
      }),
    ).toBe(true);
  });

  it("ne masque pas les erreurs de transcription réellement bloquantes", () => {
    expect(
      shouldIgnoreLiveTranscriptionError({
        code: "SERVICE_ERROR",
        details: "Voice transcription service authentication is missing",
      }),
    ).toBe(false);
  });
});

describe("case status helpers", () => {
  it("compte comme non encore traités les patients en attente et en cours de traitement", () => {
    expect(
      countPendingTreatmentCases([
        { status: "en_attente" as const },
        { status: "en_cours" as const },
        { status: "termine" as const },
        { status: "oriente" as const },
      ]),
    ).toBe(2);
  });

  it("identifie correctement les statuts encore non traités et le libellé traité", () => {
    expect(isCasePendingTreatment("en_attente")).toBe(true);
    expect(isCasePendingTreatment("en_cours")).toBe(true);
    expect(isCasePendingTreatment("termine")).toBe(false);
    expect(triageStatusLabels.termine).toBe("Traité");
  });
});

describe("access portal helpers", () => {
  it("autorise l’accès personnel uniquement si le compte connecté est admin et correspond à l’email saisi", () => {
    expect(
      isAuthorizedStaffAccess({
        isAuthenticated: true,
        expectedAdminEmail: "Admin@Hopital.ma ",
        userEmail: "admin@hopital.ma",
        userRole: "admin",
      }),
    ).toBe(true);

    expect(
      isAuthorizedStaffAccess({
        isAuthenticated: true,
        expectedAdminEmail: "admin@hopital.ma",
        userEmail: "soignant@hopital.ma",
        userRole: "admin",
      }),
    ).toBe(false);

    expect(
      isAuthorizedStaffAccess({
        isAuthenticated: true,
        expectedAdminEmail: "admin@hopital.ma",
        userEmail: "admin@hopital.ma",
        userRole: "user",
      }),
    ).toBe(false);
  });

  it("normalise les emails de contrôle d’accès avant comparaison", () => {
    expect(normalizeAccessEmail("  Admin@Hopital.ma  ")).toBe("admin@hopital.ma");
  });

  it("sélectionne un lien patient actif non expiré pour l’accès public direct", () => {
    const selected = pickActivePatientEntryLink(
      [
        { token: "expired", isActive: true, expiresAt: "2026-04-01T10:00:00.000Z" },
        { token: "inactive", isActive: false, expiresAt: null },
        { token: "active", isActive: true, expiresAt: "2026-04-10T10:00:00.000Z" },
      ],
      new Date("2026-04-05T10:00:00.000Z").getTime(),
    );

    expect(selected?.token).toBe("active");
  });

  it("retourne null lorsqu’aucun lien patient public n’est réutilisable", () => {
    const selected = pickActivePatientEntryLink(
      [
        { token: "expired", isActive: true, expiresAt: "2026-04-01T10:00:00.000Z" },
        { token: "inactive", isActive: false, expiresAt: null },
      ],
      new Date("2026-04-05T10:00:00.000Z").getTime(),
    );

    expect(selected).toBeNull();
  });
});

describe("patientIdentity helpers", () => {
  it("normalise une date au format ISO", () => {
    expect(normalizeDate("04/11/1986")).toBe("1986-11-04");
    expect(normalizeDate("1986-11-04")).toBe("1986-11-04");
  });

  it("masque le numéro de sécurité sociale et le hache de manière déterministe", () => {
    expect(maskSocialSecurityNumber("1234567890123")).toBe("•••••••••0123");
    expect(hashSensitiveValue("1234567890123")).toBe(hashSensitiveValue("1234567890123"));
  });

  it("extrait les données dictées dans une transcription vocale", () => {
    const result = extractIdentityFromTranscript(
      "Je m'appelle Sara Benali, date de naissance 14-02-1992, numéro de sécurité sociale 2840212345678",
    );

    expect(result.firstName).toContain("Sara");
    expect(result.dateOfBirth).toBe("1992-02-14");
    expect(result.socialSecurityNumber).toBe("2840212345678");
  });

  it("fusionne plusieurs brouillons d’identité en conservant les champs disponibles", () => {
    const merged = mergeIdentityDrafts(
      { firstName: "Nadia", lastName: "", dateOfBirth: "", socialSecurityNumber: "" },
      { firstName: "", lastName: "Alaoui", dateOfBirth: "1985-09-01", socialSecurityNumber: "AB123456" },
    );

    expect(merged).toEqual({
      firstName: "Nadia",
      lastName: "Alaoui",
      dateOfBirth: "1985-09-01",
      socialSecurityNumber: "AB123456",
    });
  });

  it("normalise un data URL audio contenant des paramètres codecs", () => {
    const decoded = decodeDataUrl("data:audio/webm;codecs=opus;base64,QQ==");

    expect(decoded.mimeType).toBe("audio/webm");
    expect(decoded.extension).toBe("webm");
    expect(decoded.buffer.equals(Buffer.from("A"))).toBe(true);
  });
});
