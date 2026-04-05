import { and, desc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { countPendingTreatmentCases } from "../shared/caseStatus";
import {
  InsertPatient,
  InsertPatientFormLink,
  InsertStaffingSnapshot,
  InsertStaffNotification,
  InsertTriageCase,
  InsertTriageEvent,
  InsertUser,
  patientFormLinks,
  patients,
  staffNotifications,
  staffingSnapshots,
  triageCases,
  triageEvents,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("La base de données n’est pas disponible.");
  }
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPatientFormLink(input: InsertPatientFormLink) {
  const db = await requireDb();
  const result = await db.insert(patientFormLinks).values(input).$returningId();
  const linkId = result[0]?.id;

  if (!linkId) {
    throw new Error("Impossible de créer le lien patient.");
  }

  const created = await db.select().from(patientFormLinks).where(eq(patientFormLinks.id, linkId)).limit(1);
  return created[0];
}

export async function listPatientFormLinks() {
  const db = await requireDb();
  return db.select().from(patientFormLinks).orderBy(desc(patientFormLinks.createdAt));
}

export async function getPatientFormLinkByToken(token: string) {
  const db = await requireDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(patientFormLinks)
    .where(
      and(
        eq(patientFormLinks.token, token),
        eq(patientFormLinks.isActive, true),
        sql`(${patientFormLinks.expiresAt} IS NULL OR ${patientFormLinks.expiresAt} > ${now})`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function touchPatientFormLinkUsage(linkId: number) {
  const db = await requireDb();
  await db.update(patientFormLinks).set({ lastUsedAt: new Date() }).where(eq(patientFormLinks.id, linkId));
}

export async function createStaffingSnapshot(input: InsertStaffingSnapshot) {
  const db = await requireDb();
  const result = await db.insert(staffingSnapshots).values(input).$returningId();
  const snapshotId = result[0]?.id;

  if (!snapshotId) {
    throw new Error("Impossible de créer le snapshot de ressources humaines.");
  }

  const created = await db
    .select()
    .from(staffingSnapshots)
    .where(eq(staffingSnapshots.id, snapshotId))
    .limit(1);
  return created[0];
}

export async function getLatestStaffingSnapshot() {
  const db = await requireDb();
  const rows = await db.select().from(staffingSnapshots).orderBy(desc(staffingSnapshots.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function createPatientRecord(input: InsertPatient) {
  const db = await requireDb();
  const result = await db.insert(patients).values(input).$returningId();
  const patientId = result[0]?.id;

  if (!patientId) {
    throw new Error("Impossible de créer le dossier patient.");
  }

  const created = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  return created[0];
}

export async function createTriageCaseRecord(input: InsertTriageCase) {
  const db = await requireDb();
  const result = await db.insert(triageCases).values(input).$returningId();
  const triageCaseId = result[0]?.id;

  if (!triageCaseId) {
    throw new Error("Impossible de créer le cas de triage.");
  }

  const created = await db.select().from(triageCases).where(eq(triageCases.id, triageCaseId)).limit(1);
  return created[0];
}

export async function createTriageEventRecord(input: InsertTriageEvent) {
  const db = await requireDb();
  const result = await db.insert(triageEvents).values(input).$returningId();
  const eventId = result[0]?.id;

  if (!eventId) {
    throw new Error("Impossible de créer l’événement clinique.");
  }

  const created = await db.select().from(triageEvents).where(eq(triageEvents.id, eventId)).limit(1);
  return created[0];
}

export async function createStaffNotificationRecord(input: InsertStaffNotification) {
  const db = await requireDb();
  const result = await db.insert(staffNotifications).values(input).$returningId();
  const notificationId = result[0]?.id;

  if (!notificationId) {
    throw new Error("Impossible de créer la notification interne.");
  }

  const created = await db
    .select()
    .from(staffNotifications)
    .where(eq(staffNotifications.id, notificationId))
    .limit(1);
  return created[0];
}

export async function markNotificationDelivered(notificationId: number, delivered = true) {
  const db = await requireDb();
  await db.update(staffNotifications).set({ delivered }).where(eq(staffNotifications.id, notificationId));
}

export async function listDashboardCases() {
  const db = await requireDb();

  return db
    .select({
      triageCaseId: triageCases.id,
      patientId: patients.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      intakeMethod: patients.intakeMethod,
      intakeSource: patients.intakeSource,
      preferredLanguage: patients.preferredLanguage,
      chiefComplaint: triageCases.chiefComplaint,
      priority: triageCases.priority,
      aiRecommendedPriority: triageCases.aiRecommendedPriority,
      entryMode: triageCases.entryMode,
      manualPriorityOverride: triageCases.manualPriorityOverride,
      status: triageCases.status,
      queueRank: triageCases.queueRank,
      queuePressureScore: triageCases.queuePressureScore,
      targetWaitMinutes: triageCases.targetWaitMinutes,
      waitingTimeMinutes: triageCases.waitingTimeMinutes,
      recommendedAction: triageCases.recommendedAction,
      protocolReference: triageCases.protocolReference,
      createdAt: triageCases.createdAt,
      updatedAt: triageCases.updatedAt,
    })
    .from(triageCases)
    .innerJoin(patients, eq(triageCases.patientId, patients.id))
    .orderBy(triageCases.queueRank, desc(triageCases.createdAt));
}

export async function listRecentNotifications(limit = 8) {
  const db = await requireDb();
  return db.select().from(staffNotifications).orderBy(desc(staffNotifications.createdAt)).limit(limit);
}

export async function getDashboardSummary() {
  const db = await requireDb();
  const [[summaryRow], cases] = await Promise.all([
    db
      .select({
        totalPatients: sql<number>`count(${triageCases.id})`,
        urgentPatients: sql<number>`sum(case when ${triageCases.priority} in ('urgence_vitale', 'urgence') then 1 else 0 end)`,
        p1Patients: sql<number>`sum(case when ${triageCases.priority} = 'urgence_vitale' then 1 else 0 end)`,
        avgWaitingMinutes: sql<number>`coalesce(avg(${triageCases.waitingTimeMinutes}), 0)`,
        manualOverrides: sql<number>`sum(case when ${triageCases.manualPriorityOverride} = true then 1 else 0 end)`,
      })
      .from(triageCases),
    db.select({ status: triageCases.status }).from(triageCases),
  ]);

  const staffing = await getLatestStaffingSnapshot();
  const pendingTreatmentCount = countPendingTreatmentCases(cases);

  return {
    totalPatients: Number(summaryRow?.totalPatients ?? 0),
    waitingPatients: pendingTreatmentCount,
    urgentPatients: Number(summaryRow?.urgentPatients ?? 0),
    p1Patients: Number(summaryRow?.p1Patients ?? 0),
    avgWaitingMinutes: Math.round(Number(summaryRow?.avgWaitingMinutes ?? 0)),
    manualOverrides: Number(summaryRow?.manualOverrides ?? 0),
    staffing: staffing
      ? {
          doctorsOnDuty: staffing.doctorsOnDuty,
          nursesOnDuty: staffing.nursesOnDuty,
          availableDoctors: staffing.availableDoctors,
          availableNurses: staffing.availableNurses,
          waitingPatients: pendingTreatmentCount,
          activeCriticalPatients: staffing.activeCriticalPatients,
          occupancyPressureScore: staffing.occupancyPressureScore,
          updatedAt: staffing.createdAt,
        }
      : null,
  };
}

export async function updateCaseStatus(triageCaseId: number, status: InsertTriageCase["status"]) {
  const db = await requireDb();
  await db.update(triageCases).set({ status }).where(eq(triageCases.id, triageCaseId));
  const updated = await db.select().from(triageCases).where(eq(triageCases.id, triageCaseId)).limit(1);
  return updated[0];
}

export async function seedDemoIfEmpty(createdByUserId?: number | null) {
  const db = await requireDb();
  const existing = await db.select({ count: sql<number>`count(*)` }).from(triageCases);
  const count = Number(existing[0]?.count ?? 0);

  if (count > 0) {
    return { inserted: false };
  }

  const [formLink] = await Promise.all([
    createPatientFormLink({
      createdByUserId: createdByUserId ?? null,
      label: "QR Hall principal",
      token: `demo-link-${Date.now()}`,
      isActive: true,
    }),
    createStaffingSnapshot({
      createdByUserId: createdByUserId ?? null,
      doctorsOnDuty: 4,
      nursesOnDuty: 8,
      availableDoctors: 2,
      availableNurses: 5,
      waitingPatients: 9,
      activeCriticalPatients: 1,
      occupancyPressureScore: 11,
      notes: "Charge modérée à élevée en début de soirée.",
    }),
  ]);

  const staffing = await getLatestStaffingSnapshot();

  const demoPatients = await db
    .insert(patients)
    .values([
      {
        createdByUserId: createdByUserId ?? null,
        formLinkId: formLink.id,
        intakeMethod: "ocr",
        intakeSource: "staff_full",
        firstName: "Amina",
        lastName: "Bennani",
        dateOfBirth: "1987-03-15",
        socialSecurityNumberMasked: "••••••••4219",
        socialSecurityNumberHash: "demo-amina",
        preferredLanguage: "fr",
        mobileNumber: "+212600000001",
        notes: "Patiente arrivée par ses propres moyens.",
      },
      {
        createdByUserId: createdByUserId ?? null,
        formLinkId: formLink.id,
        intakeMethod: "vocal",
        intakeSource: "staff_full",
        firstName: "Youssef",
        lastName: "El Idrissi",
        dateOfBirth: "1999-08-21",
        socialSecurityNumberMasked: "••••••••8432",
        socialSecurityNumberHash: "demo-youssef",
        preferredLanguage: "ar",
        mobileNumber: "+212600000002",
        notes: "Accompagné par un proche.",
      },
      {
        createdByUserId: createdByUserId ?? null,
        formLinkId: formLink.id,
        intakeMethod: "manuel",
        intakeSource: "patient_qr",
        firstName: "Leïla",
        lastName: "Tazi",
        dateOfBirth: "1974-11-02",
        socialSecurityNumberMasked: "••••••••1937",
        socialSecurityNumberHash: "demo-leila",
        preferredLanguage: "fr",
        mobileNumber: "+212600000003",
        notes: "Douleur post-traumatique du membre supérieur.",
      },
    ])
    .$returningId();

  const [amina, youssef, leila] = demoPatients;

  await db.insert(triageCases).values([
    {
      patientId: amina!.id,
      createdByUserId: createdByUserId ?? null,
      staffingSnapshotId: staffing?.id ?? null,
      chiefComplaint: "Douleur thoracique brutale",
      symptomSummary: "Douleur thoracique intense avec oppression et gêne respiratoire depuis 20 minutes.",
      painLevel: 9,
      canWalk: false,
      hasBleeding: false,
      hasSevereBleeding: false,
      hasBreathingDifficulty: true,
      hasChestPain: true,
      hasNeurologicalDeficit: false,
      hasLossOfConsciousness: false,
      hasHighFever: false,
      hasTrauma: false,
      isPregnant: false,
      oxygenSaturation: 91,
      heartRate: 122,
      respiratoryRate: 28,
      systolicBloodPressure: 95,
      priority: "urgence",
      aiRecommendedPriority: "urgence",
      entryMode: "standard_ai",
      manualPriorityOverride: false,
      skipAiAnalysis: false,
      queuePressureScore: staffing?.occupancyPressureScore ?? 0,
      status: "en_attente",
      targetWaitMinutes: 15,
      waitingTimeMinutes: 7,
      queueRank: 2,
      rationaleJson: JSON.stringify([
        "Douleur thoracique aiguë.",
        "Gêne respiratoire associée.",
      ]),
      aiSummaryJson: JSON.stringify({
        suspectedPriority: "urgence",
        clinicalSignals: ["douleur thoracique", "essoufflement"],
        riskFactors: ["possible syndrome coronarien"],
        suggestedQuestions: ["irradiation", "durée", "ATCD cardiaques"],
        summary: "Tableau compatible avec un cas urgent nécessitant une évaluation rapide.",
      }),
      recommendedAction: "Évaluation clinique rapide et monitorage continu.",
      protocolReference: "ESI niveau 2 simplifié + modulation capacitaire",
      clinicianValidation: "En attente de validation médicale.",
    },
    {
      patientId: youssef!.id,
      createdByUserId: createdByUserId ?? null,
      staffingSnapshotId: staffing?.id ?? null,
      chiefComplaint: "Malaise avec perte de connaissance",
      symptomSummary: "Episode de perte de connaissance avec reprise incomplète et confusion.",
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
      heartRate: 132,
      respiratoryRate: 31,
      systolicBloodPressure: 82,
      priority: "urgence_vitale",
      aiRecommendedPriority: "urgence_vitale",
      entryMode: "manual_p1",
      manualPriorityOverride: true,
      manualPriorityReason: "Décision infirmier d’accueil devant altération de conscience.",
      skipAiAnalysis: true,
      queuePressureScore: staffing?.occupancyPressureScore ?? 0,
      status: "en_cours",
      targetWaitMinutes: 0,
      waitingTimeMinutes: 0,
      queueRank: 1,
      rationaleJson: JSON.stringify([
        "Altération de conscience.",
        "Constantes instables.",
        "Override manuel P1.",
      ]),
      aiSummaryJson: JSON.stringify({
        suspectedPriority: "urgence_vitale",
        clinicalSignals: ["syncope", "détresse respiratoire"],
        riskFactors: ["instabilité hémodynamique"],
        suggestedQuestions: [],
        summary: "Le cas a été traité en priorité vitale immédiate.",
      }),
      recommendedAction: "Alerte réanimation immédiate.",
      protocolReference: "Override clinique immédiat P1",
      clinicianValidation: "Pris en charge en salle critique.",
    },
    {
      patientId: leila!.id,
      createdByUserId: createdByUserId ?? null,
      staffingSnapshotId: staffing?.id ?? null,
      chiefComplaint: "Suspicion de fracture du poignet",
      symptomSummary: "Traumatisme du poignet après chute domestique, douleur modérée, tuméfaction locale.",
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
      heartRate: 84,
      respiratoryRate: 18,
      systolicBloodPressure: 122,
      priority: "semi_urgence",
      aiRecommendedPriority: "semi_urgence",
      entryMode: "standard_ai",
      manualPriorityOverride: false,
      skipAiAnalysis: false,
      queuePressureScore: staffing?.occupancyPressureScore ?? 0,
      status: "en_attente",
      targetWaitMinutes: 60,
      waitingTimeMinutes: 24,
      queueRank: 3,
      rationaleJson: JSON.stringify([
        "Traumatisme récent sans signe vital critique.",
      ]),
      aiSummaryJson: JSON.stringify({
        suspectedPriority: "semi_urgence",
        clinicalSignals: ["traumatisme membre supérieur"],
        riskFactors: ["fracture suspectée"],
        suggestedQuestions: ["déformation", "douleur doigts", "mécanisme chute"],
        summary: "Prise en charge différable mais nécessitant imagerie et antalgie.",
      }),
      recommendedAction: "Radiographie et antalgie selon protocole.",
      protocolReference: "ESI niveau 3 simplifié + modulation capacitaire",
      clinicianValidation: "En attente de validation médicale.",
    },
  ]);

  await db.insert(staffNotifications).values([
    {
      severity: "critical",
      title: "Cas critique en cours",
      content: "Patient Youssef El Idrissi orienté en prise en charge vitale immédiate.",
      delivered: true,
    },
    {
      severity: "urgent",
      title: "Nouvelle alerte urgente",
      content: "Amina Bennani nécessite une évaluation rapide pour douleur thoracique.",
      delivered: true,
    },
  ]);

  return { inserted: true };
}

export async function getCaseTimeline(triageCaseId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(triageEvents)
    .where(eq(triageEvents.triageCaseId, triageCaseId))
    .orderBy(desc(triageEvents.createdAt));
}

export async function getCaseById(triageCaseId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      triageCaseId: triageCases.id,
      patientId: patients.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientDateOfBirth: patients.dateOfBirth,
      patientSocialSecurityNumberMasked: patients.socialSecurityNumberMasked,
      identitySourceUrl: patients.identitySourceUrl,
      preferredLanguage: patients.preferredLanguage,
      mobileNumber: patients.mobileNumber,
      patientNotes: patients.notes,
      intakeMethod: patients.intakeMethod,
      intakeSource: patients.intakeSource,
      voiceTranscript: patients.voiceTranscript,
      chiefComplaint: triageCases.chiefComplaint,
      symptomSummary: triageCases.symptomSummary,
      painLevel: triageCases.painLevel,
      canWalk: triageCases.canWalk,
      hasBleeding: triageCases.hasBleeding,
      hasSevereBleeding: triageCases.hasSevereBleeding,
      hasBreathingDifficulty: triageCases.hasBreathingDifficulty,
      hasChestPain: triageCases.hasChestPain,
      hasNeurologicalDeficit: triageCases.hasNeurologicalDeficit,
      hasLossOfConsciousness: triageCases.hasLossOfConsciousness,
      hasHighFever: triageCases.hasHighFever,
      hasTrauma: triageCases.hasTrauma,
      isPregnant: triageCases.isPregnant,
      oxygenSaturation: triageCases.oxygenSaturation,
      heartRate: triageCases.heartRate,
      respiratoryRate: triageCases.respiratoryRate,
      systolicBloodPressure: triageCases.systolicBloodPressure,
      priority: triageCases.priority,
      aiRecommendedPriority: triageCases.aiRecommendedPriority,
      entryMode: triageCases.entryMode,
      manualPriorityOverride: triageCases.manualPriorityOverride,
      manualPriorityReason: triageCases.manualPriorityReason,
      queuePressureScore: triageCases.queuePressureScore,
      queueRank: triageCases.queueRank,
      status: triageCases.status,
      targetWaitMinutes: triageCases.targetWaitMinutes,
      waitingTimeMinutes: triageCases.waitingTimeMinutes,
      recommendedAction: triageCases.recommendedAction,
      protocolReference: triageCases.protocolReference,
      clinicianValidation: triageCases.clinicianValidation,
      rationaleJson: triageCases.rationaleJson,
      aiSummaryJson: triageCases.aiSummaryJson,
      createdAt: triageCases.createdAt,
      updatedAt: triageCases.updatedAt,
    })
    .from(triageCases)
    .innerJoin(patients, eq(triageCases.patientId, patients.id))
    .where(eq(triageCases.id, triageCaseId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listActivePatientsForStaff(limit = 20) {
  const db = await requireDb();
  return db
    .select({
      triageCaseId: triageCases.id,
      patientDisplayName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
      priority: triageCases.priority,
      status: triageCases.status,
      queueRank: triageCases.queueRank,
      waitingTimeMinutes: triageCases.waitingTimeMinutes,
      chiefComplaint: triageCases.chiefComplaint,
      intakeSource: patients.intakeSource,
      entryMode: triageCases.entryMode,
      createdAt: triageCases.createdAt,
    })
    .from(triageCases)
    .innerJoin(patients, eq(triageCases.patientId, patients.id))
    .where(gt(triageCases.id, 0))
    .orderBy(triageCases.queueRank, desc(triageCases.createdAt))
    .limit(limit);
}
