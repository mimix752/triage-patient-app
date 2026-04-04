export type TriagePriority = "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent";

export type TriageStatus = "en_attente" | "en_cours" | "oriente" | "termine";

export type IntakeMethod = "ocr" | "manuel" | "vocal";

export type SymptomAssessmentInput = {
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

export type TriageAssessment = {
  priority: TriagePriority;
  label: string;
  color: string;
  targetWaitMinutes: number;
  queueRank: number;
  rationale: string[];
  recommendedAction: string;
  protocolReference: string;
  severe: boolean;
};

export type GuidedQuestion = {
  id: string;
  label: string;
  helper: string;
  kind: "toggle" | "scale" | "text";
};

export const guidedQuestions: GuidedQuestion[] = [
  {
    id: "chiefComplaint",
    label: "Motif principal de consultation",
    helper: "Décrire en quelques mots la raison principale de la venue aux urgences.",
    kind: "text",
  },
  {
    id: "symptomSummary",
    label: "Résumé clinique",
    helper: "Préciser les symptômes, leur durée et tout élément aggravant ou calmant.",
    kind: "text",
  },
  {
    id: "painLevel",
    label: "Niveau de douleur",
    helper: "Évaluer la douleur sur une échelle de 0 à 10.",
    kind: "scale",
  },
  {
    id: "hasBreathingDifficulty",
    label: "Difficulté respiratoire",
    helper: "Le patient présente-t-il une gêne respiratoire, un essoufflement ou des signes de détresse ?",
    kind: "toggle",
  },
  {
    id: "hasChestPain",
    label: "Douleur thoracique",
    helper: "Présence d’une douleur thoracique ou d’une oppression inhabituelle.",
    kind: "toggle",
  },
  {
    id: "hasNeurologicalDeficit",
    label: "Déficit neurologique",
    helper: "Faiblesse brutale, trouble de la parole, asymétrie faciale, convulsions ou confusion aiguë.",
    kind: "toggle",
  },
  {
    id: "hasLossOfConsciousness",
    label: "Perte de connaissance / altération majeure",
    helper: "Le patient a-t-il perdu connaissance ou présente-t-il une altération majeure de l’état de conscience ?",
    kind: "toggle",
  },
  {
    id: "hasSevereBleeding",
    label: "Hémorragie sévère",
    helper: "Saignement abondant actif, extériorisé ou suspecté, non contrôlé.",
    kind: "toggle",
  },
  {
    id: "hasTrauma",
    label: "Traumatisme récent",
    helper: "Chute, accident, fracture suspectée ou traumatisme significatif.",
    kind: "toggle",
  },
  {
    id: "hasHighFever",
    label: "Fièvre élevée",
    helper: "Fièvre importante associée à un état général altéré ou à des frissons.",
    kind: "toggle",
  },
];

const PRIORITY_CONFIG: Record<TriagePriority, Omit<TriageAssessment, "rationale">> = {
  urgence_vitale: {
    priority: "urgence_vitale",
    label: "Urgence vitale",
    color: "#d9485f",
    targetWaitMinutes: 0,
    queueRank: 1,
    recommendedAction: "Alerter immédiatement l’équipe de réanimation et déclencher une prise en charge sans délai.",
    protocolReference: "ESI niveau 1 simplifié",
    severe: true,
  },
  urgence: {
    priority: "urgence",
    label: "Urgence",
    color: "#f08c2e",
    targetWaitMinutes: 15,
    queueRank: 2,
    recommendedAction: "Faire évaluer rapidement le patient par un clinicien et maintenir une surveillance rapprochée.",
    protocolReference: "ESI niveau 2 simplifié",
    severe: true,
  },
  semi_urgence: {
    priority: "semi_urgence",
    label: "Semi-urgence",
    color: "#4f7cff",
    targetWaitMinutes: 60,
    queueRank: 3,
    recommendedAction: "Installer le patient en zone de soins et compléter le bilan clinique dans le délai cible.",
    protocolReference: "ESI niveau 3 simplifié",
    severe: false,
  },
  non_urgent: {
    priority: "non_urgent",
    label: "Non-urgent",
    color: "#3ca67a",
    targetWaitMinutes: 120,
    queueRank: 4,
    recommendedAction: "Orienter vers la consultation adaptée, poursuivre l’évaluation standard et réévaluer en cas d’aggravation.",
    protocolReference: "ESI niveau 4-5 simplifié",
    severe: false,
  },
};

function clampPainLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, Math.round(value)));
}

function hasDangerousVitals(input: SymptomAssessmentInput): boolean {
  const sat = input.oxygenSaturation ?? null;
  const hr = input.heartRate ?? null;
  const rr = input.respiratoryRate ?? null;
  const sbp = input.systolicBloodPressure ?? null;

  return Boolean(
    (sat !== null && sat < 90) ||
      (hr !== null && hr >= 130) ||
      (rr !== null && rr >= 30) ||
      (sbp !== null && sbp <= 90),
  );
}

export function computeTriageAssessment(rawInput: SymptomAssessmentInput): TriageAssessment {
  const input: SymptomAssessmentInput = {
    ...rawInput,
    painLevel: clampPainLevel(rawInput.painLevel),
  };

  const rationale: string[] = [];

  if (input.hasLossOfConsciousness) {
    rationale.push("Altération majeure de l’état de conscience signalée.");
  }
  if (input.hasSevereBleeding) {
    rationale.push("Hémorragie sévère active ou suspectée.");
  }
  if (input.hasBreathingDifficulty) {
    rationale.push("Détresse respiratoire ou difficulté respiratoire rapportée.");
  }
  if (input.hasNeurologicalDeficit) {
    rationale.push("Déficit neurologique aigu nécessitant une évaluation prioritaire.");
  }
  if (hasDangerousVitals(input)) {
    rationale.push("Constantes physiologiques potentiellement instables.");
  }

  if (
    input.hasLossOfConsciousness ||
    input.hasSevereBleeding ||
    (input.hasBreathingDifficulty && (input.oxygenSaturation ?? 100) < 92) ||
    hasDangerousVitals(input)
  ) {
    return {
      ...PRIORITY_CONFIG.urgence_vitale,
      rationale: rationale.length ? rationale : ["Présentation compatible avec un risque vital immédiat."],
    };
  }

  if (
    input.hasBreathingDifficulty ||
    input.hasChestPain ||
    input.hasNeurologicalDeficit ||
    input.painLevel >= 8 ||
    (input.hasBleeding && !input.hasSevereBleeding) ||
    (input.hasHighFever && !input.canWalk) ||
    (input.isPregnant && (input.hasBleeding || input.painLevel >= 7))
  ) {
    if (!rationale.length) {
      rationale.push("Tableau à haut risque ou douleur sévère nécessitant une prise en charge rapide.");
    }

    return {
      ...PRIORITY_CONFIG.urgence,
      rationale,
    };
  }

  if (
    input.hasTrauma ||
    input.painLevel >= 4 ||
    input.hasHighFever ||
    !input.canWalk ||
    input.chiefComplaint.toLowerCase().includes("fract") ||
    input.symptomSummary.toLowerCase().includes("vom")
  ) {
    rationale.push("Évaluation médicale nécessaire sans critère vital immédiat retrouvé.");

    return {
      ...PRIORITY_CONFIG.semi_urgence,
      rationale,
    };
  }

  rationale.push("Aucun critère de gravité immédiate détecté dans le questionnaire guidé.");

  return {
    ...PRIORITY_CONFIG.non_urgent,
    rationale,
  };
}

export function priorityToHuman(priority: TriagePriority): string {
  return PRIORITY_CONFIG[priority].label;
}

export function getPriorityConfig(priority: TriagePriority) {
  return PRIORITY_CONFIG[priority];
}

export const triageProtocolSummary = {
  title: "Cadre de triage clinique du prototype",
  description:
    "Le moteur applique une logique de priorisation simplifiée inspirée des systèmes ESI, avec détection immédiate des situations vitales, repérage des tableaux à haut risque, puis orientation semi-urgente ou non urgente. Il s’agit d’un outil d’aide à l’orientation qui ne remplace jamais la validation clinique par un professionnel habilité.",
  references: [
    "ESI niveau 1 simplifié",
    "ESI niveau 2 simplifié",
    "ESI niveau 3 simplifié",
    "ESI niveau 4-5 simplifié",
  ],
};
