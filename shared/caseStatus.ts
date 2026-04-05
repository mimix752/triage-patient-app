export type TriageCaseStatus = "en_attente" | "en_cours" | "oriente" | "termine";

export const triageStatusLabels: Record<TriageCaseStatus, string> = {
  en_attente: "En attente",
  en_cours: "En cours de traitement",
  oriente: "Orienté",
  termine: "Traité",
};

export function isCasePendingTreatment(status: TriageCaseStatus) {
  return status === "en_attente" || status === "en_cours";
}

export function countPendingTreatmentCases<T extends { status: TriageCaseStatus }>(cases: T[]) {
  return cases.filter((item) => isCasePendingTreatment(item.status)).length;
}
