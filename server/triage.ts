export type Priority = "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent";

export type ClinicalAssessmentInput = {
  chiefComplaint: string;
  symptomSummary: string;
  painLevel: number;
  canWalk: boolean;
  hasBleeding: boolean;
  hasSevereBleeding: boolean;
  hasBreathingDifficulty: boolean;
  hasChestPain: boolean;
  hasNeurologicalDeficit: boolean;
  hasLossOfConsciousness: boolean;
  hasHighFever: boolean;
  hasTrauma: boolean;
  isPregnant: boolean;
  oxygenSaturation?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  systolicBloodPressure?: number | null;
};

export type StaffingContext = {
  doctorsOnDuty: number;
  nursesOnDuty: number;
  availableDoctors: number;
  availableNurses: number;
  waitingPatients: number;
  activeCriticalPatients: number;
  notes?: string | null;
};

export type AiClinicalInsights = {
  suspectedPriority: Priority | "";
  clinicalSignals: string[];
  riskFactors: string[];
  suggestedQuestions: string[];
  summary: string;
};

export type TriageAssessment = {
  priority: Priority;
  aiRecommendedPriority: Priority;
  severe: boolean;
  label: string;
  entryMode: "standard_ai" | "manual_p1" | "manual_staff";
  manualPriorityOverride: boolean;
  manualPriorityReason: string | null;
  skipAiAnalysis: boolean;
  queuePressureScore: number;
  queueRank: number;
  targetWaitMinutes: number;
  rationale: string[];
  aiSummary: AiClinicalInsights | null;
  recommendedAction: string;
  protocolReference: string;
};

const priorityWeight: Record<Priority, number> = {
  urgence_vitale: 4,
  urgence: 3,
  semi_urgence: 2,
  non_urgent: 1,
};

const priorityLabel: Record<Priority, string> = {
  urgence_vitale: "P1 · Urgence vitale",
  urgence: "P2 · Urgence",
  semi_urgence: "P3 · Semi-urgence",
  non_urgent: "P4 · Non urgent",
};

const targetWaitByPriority: Record<Priority, number> = {
  urgence_vitale: 0,
  urgence: 15,
  semi_urgence: 60,
  non_urgent: 120,
};

const actionByPriority: Record<Priority, string> = {
  urgence_vitale: "Alerte immédiate du personnel médical, orientation vers zone critique et surveillance continue.",
  urgence: "Évaluation médicale rapide, monitorage rapproché et priorisation du bilan initial.",
  semi_urgence: "Installation en zone d’attente surveillée, examens ciblés et réévaluation périodique.",
  non_urgent: "Orientation vers circuit de consultation ou prise en charge différée selon le flux.",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function priorityFromWeight(weight: number): Priority {
  if (weight >= 4) return "urgence_vitale";
  if (weight >= 3) return "urgence";
  if (weight >= 2) return "semi_urgence";
  return "non_urgent";
}

export function computeQueuePressureScore(staffing?: StaffingContext | null) {
  if (!staffing) return 0;

  const operationalStaff = Math.max(1, staffing.availableDoctors + staffing.availableNurses);
  const rawPressure =
    staffing.waitingPatients * 1.2 +
    staffing.activeCriticalPatients * 2.6 -
    staffing.availableDoctors * 1.3 -
    staffing.availableNurses * 0.8;

  const normalized = rawPressure / operationalStaff;
  return clamp(Math.round(normalized * 4), 0, 24);
}

function basePriorityFromClinicalSignals(input: ClinicalAssessmentInput) {
  const rationale: string[] = [];
  let weight = 1;

  if (input.hasLossOfConsciousness) {
    weight = Math.max(weight, 4);
    rationale.push("Altération majeure ou perte de conscience signalée.");
  }

  if (input.hasSevereBleeding) {
    weight = Math.max(weight, 4);
    rationale.push("Hémorragie sévère ou non contrôlée.");
  }

  if ((input.oxygenSaturation ?? 100) < 90) {
    weight = Math.max(weight, 4);
    rationale.push("Saturation en oxygène inférieure à 90 %.");
  }

  if ((input.systolicBloodPressure ?? 200) < 90) {
    weight = Math.max(weight, 4);
    rationale.push("Pression artérielle systolique très basse.");
  }

  if (input.hasBreathingDifficulty) {
    weight = Math.max(weight, 3);
    rationale.push("Difficulté respiratoire rapportée.");
  }

  if (input.hasChestPain) {
    weight = Math.max(weight, 3);
    rationale.push("Douleur thoracique nécessitant exclusion d’un syndrome aigu.");
  }

  if (input.hasNeurologicalDeficit) {
    weight = Math.max(weight, 3);
    rationale.push("Signe neurologique focal ou déficit rapporté.");
  }

  if ((input.heartRate ?? 0) >= 130) {
    weight = Math.max(weight, 3);
    rationale.push("Tachycardie importante.");
  }

  if ((input.respiratoryRate ?? 0) >= 30) {
    weight = Math.max(weight, 3);
    rationale.push("Fréquence respiratoire élevée.");
  }

  if (input.hasTrauma) {
    weight = Math.max(weight, 2);
    rationale.push("Contexte traumatique récent.");
  }

  if (input.hasHighFever) {
    weight = Math.max(weight, 2);
    rationale.push("Fièvre élevée ou suspicion infectieuse aiguë.");
  }

  if (input.painLevel >= 8) {
    weight = Math.max(weight, 2);
    rationale.push("Douleur sévère rapportée.");
  }

  if (!input.canWalk) {
    weight = Math.max(weight, 2);
    rationale.push("Patient non autonome à la marche.");
  }

  if (input.isPregnant) {
    weight = Math.max(weight, 2);
    rationale.push("Contexte obstétrical nécessitant vigilance.");
  }

  if (rationale.length === 0) {
    rationale.push("Aucun signal de gravité majeure détecté à la saisie initiale.");
  }

  return {
    priority: priorityFromWeight(weight),
    rationale,
  };
}

function mergeWithAiPriority(base: Priority, aiInsights?: AiClinicalInsights | null) {
  if (!aiInsights?.suspectedPriority) return base;

  return priorityWeight[aiInsights.suspectedPriority] > priorityWeight[base]
    ? aiInsights.suspectedPriority
    : base;
}

function adaptPriorityToOperationalPressure(priority: Priority, queuePressureScore: number) {
  if (priority === "urgence_vitale" || priority === "urgence") return priority;
  if (queuePressureScore >= 16 && priority === "non_urgent") return "semi_urgence";
  if (queuePressureScore >= 20 && priority === "semi_urgence") return "urgence";
  return priority;
}

function computeQueueRank(priority: Priority, queuePressureScore: number) {
  const baseRank = {
    urgence_vitale: 1,
    urgence: 2,
    semi_urgence: 3,
    non_urgent: 4,
  }[priority];

  const pressureBonus = queuePressureScore >= 18 ? -1 : 0;
  return clamp(baseRank + pressureBonus, 1, 6);
}

export function computeResourceAwareTriageAssessment(
  input: ClinicalAssessmentInput,
  options?: {
    staffing?: StaffingContext | null;
    aiInsights?: AiClinicalInsights | null;
    manualPriority?: Priority | null;
    manualReason?: string;
    skipAiAnalysis?: boolean;
  },
): TriageAssessment {
  const queuePressureScore = computeQueuePressureScore(options?.staffing ?? null);
  const base = basePriorityFromClinicalSignals(input);
  const aiRecommendedPriority = mergeWithAiPriority(base.priority, options?.aiInsights ?? null);

  let finalPriority = aiRecommendedPriority;
  finalPriority = adaptPriorityToOperationalPressure(finalPriority, queuePressureScore);

  let entryMode: TriageAssessment["entryMode"] = "standard_ai";
  let manualPriorityOverride = false;
  let manualPriorityReason: string | null = null;

  if (options?.manualPriority) {
    finalPriority = options.manualPriority;
    entryMode = options.manualPriority === "urgence_vitale" ? "manual_p1" : "manual_staff";
    manualPriorityOverride = true;
    manualPriorityReason = options.manualReason?.trim() || "Priorité imposée par le personnel soignant.";
    base.rationale.unshift("Priorité imposée manuellement par le personnel soignant.");
  } else if (queuePressureScore >= 16 && finalPriority !== aiRecommendedPriority) {
    base.rationale.push("La priorité a été modulée en tenant compte de la charge opérationnelle du service.");
  } else if (queuePressureScore >= 10) {
    base.rationale.push("La charge du service a été prise en compte dans l’ordonnancement du dossier.");
  }

  if (options?.aiInsights?.summary) {
    base.rationale.push(`Synthèse IA: ${options.aiInsights.summary}`);
  }

  const protocolReference = manualPriorityOverride
    ? "Override clinique prioritaire + supervision humaine"
    : {
        urgence_vitale: "ESI niveau 1 · Règles cliniques + synthèse IA + modulation capacitaire",
        urgence: "ESI niveau 2 · Règles cliniques + synthèse IA + modulation capacitaire",
        semi_urgence: "ESI niveau 3 · Règles cliniques + synthèse IA + modulation capacitaire",
        non_urgent: "ESI niveau 4/5 · Règles cliniques + synthèse IA + modulation capacitaire",
      }[finalPriority];

  return {
    priority: finalPriority,
    aiRecommendedPriority,
    severe: priorityWeight[finalPriority] >= 3,
    label: priorityLabel[finalPriority],
    entryMode,
    manualPriorityOverride,
    manualPriorityReason,
    skipAiAnalysis: Boolean(options?.skipAiAnalysis),
    queuePressureScore,
    queueRank: computeQueueRank(finalPriority, queuePressureScore),
    targetWaitMinutes: targetWaitByPriority[finalPriority],
    rationale: base.rationale,
    aiSummary: options?.aiInsights ?? null,
    recommendedAction: actionByPriority[finalPriority],
    protocolReference,
  };
}

export function createManualP1Assessment(reason: string, staffing?: StaffingContext | null): TriageAssessment {
  const queuePressureScore = computeQueuePressureScore(staffing ?? null);
  return {
    priority: "urgence_vitale",
    aiRecommendedPriority: "urgence_vitale",
    severe: true,
    label: priorityLabel.urgence_vitale,
    entryMode: "manual_p1",
    manualPriorityOverride: true,
    manualPriorityReason: reason.trim() || "Décision immédiate du personnel soignant.",
    skipAiAnalysis: true,
    queuePressureScore,
    queueRank: 1,
    targetWaitMinutes: 0,
    rationale: [
      "Admission critique immédiate décidée par le personnel soignant.",
      "Aucune attente de collecte exhaustive ou d’analyse IA avant orientation.",
    ],
    aiSummary: {
      suspectedPriority: "urgence_vitale",
      clinicalSignals: ["override manuel P1"],
      riskFactors: ["risque vital perçu par le personnel"],
      suggestedQuestions: [],
      summary: "Cas orienté directement en priorité vitale sans délai d’analyse.",
    },
    recommendedAction: actionByPriority.urgence_vitale,
    protocolReference: "Override clinique immédiat P1",
  };
}

export const guidedQuestions = [
  "Depuis quand les symptômes ont-ils commencé ?",
  "La douleur ou la gêne s’aggrave-t-elle ?",
  "Le patient peut-il marcher ou parler normalement ?",
  "Y a-t-il un saignement, une perte de connaissance ou une difficulté respiratoire ?",
  "Existe-t-il un traumatisme récent ou un contexte particulier (grossesse, infection, traitement en cours) ?",
];

export const triageProtocolSummary = {
  title: "Cadre de priorisation clinique du prototype",
  description:
    "Le prototype combine des règles cliniques explicables, une synthèse IA prudente et un ajustement lié à la pression opérationnelle du service. La validation finale reste humaine.",
  levels: [
    {
      code: "P1",
      label: "Urgence vitale",
      description: "Détresse vitale actuelle ou suspicion immédiate de défaillance majeure.",
      targetMinutes: 0,
    },
    {
      code: "P2",
      label: "Urgence",
      description: "Risque élevé de dégradation rapide nécessitant évaluation prioritaire.",
      targetMinutes: 15,
    },
    {
      code: "P3",
      label: "Semi-urgence",
      description: "État stable à surveiller avec bilan ou traitement dans le flux court.",
      targetMinutes: 60,
    },
    {
      code: "P4",
      label: "Non urgent",
      description: "Motif sans gravité immédiate apparente, pouvant attendre davantage.",
      targetMinutes: 120,
    },
  ],
};

export function computeTriageAssessment(input: ClinicalAssessmentInput) {
  return computeResourceAwareTriageAssessment(input, {});
}
