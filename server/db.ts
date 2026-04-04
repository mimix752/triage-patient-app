import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertPatient,
  InsertStaffNotification,
  InsertTriageCase,
  InsertTriageEvent,
  InsertUser,
  patients,
  staffNotifications,
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
  await db
    .update(staffNotifications)
    .set({ delivered })
    .where(eq(staffNotifications.id, notificationId));
}

export async function listDashboardCases() {
  const db = await requireDb();

  const rows = await db
    .select({
      triageCaseId: triageCases.id,
      patientId: patients.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      intakeMethod: patients.intakeMethod,
      preferredLanguage: patients.preferredLanguage,
      chiefComplaint: triageCases.chiefComplaint,
      priority: triageCases.priority,
      status: triageCases.status,
      queueRank: triageCases.queueRank,
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

  return rows;
}

export async function listRecentNotifications(limit = 8) {
  const db = await requireDb();
  return db
    .select()
    .from(staffNotifications)
    .orderBy(desc(staffNotifications.createdAt))
    .limit(limit);
}

export async function getDashboardSummary() {
  const db = await requireDb();
  const [row] = await db
    .select({
      totalPatients: sql<number>`count(${triageCases.id})`,
      waitingPatients: sql<number>`sum(case when ${triageCases.status} = 'en_attente' then 1 else 0 end)`,
      urgentPatients: sql<number>`sum(case when ${triageCases.priority} in ('urgence_vitale', 'urgence') then 1 else 0 end)`,
      avgWaitingMinutes: sql<number>`coalesce(avg(${triageCases.waitingTimeMinutes}), 0)`,
    })
    .from(triageCases);

  return {
    totalPatients: Number(row?.totalPatients ?? 0),
    waitingPatients: Number(row?.waitingPatients ?? 0),
    urgentPatients: Number(row?.urgentPatients ?? 0),
    avgWaitingMinutes: Math.round(Number(row?.avgWaitingMinutes ?? 0)),
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

  const demoPatients = await db
    .insert(patients)
    .values([
      {
        createdByUserId: createdByUserId ?? null,
        intakeMethod: "ocr",
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
        intakeMethod: "vocal",
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
        intakeMethod: "manuel",
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
      status: "en_attente",
      targetWaitMinutes: 15,
      waitingTimeMinutes: 7,
      queueRank: 2,
      rationaleJson: JSON.stringify([
        "Douleur thoracique aiguë.",
        "Gêne respiratoire associée.",
      ]),
      recommendedAction: "Évaluation clinique rapide et monitorage continu.",
      protocolReference: "ESI niveau 2 simplifié",
      clinicianValidation: "En attente de validation médicale.",
    },
    {
      patientId: youssef!.id,
      createdByUserId: createdByUserId ?? null,
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
      status: "en_cours",
      targetWaitMinutes: 0,
      waitingTimeMinutes: 0,
      queueRank: 1,
      rationaleJson: JSON.stringify([
        "Altération de conscience.",
        "Constantes instables.",
      ]),
      recommendedAction: "Alerte réanimation immédiate.",
      protocolReference: "ESI niveau 1 simplifié",
      clinicianValidation: "Pris en charge en salle critique.",
    },
    {
      patientId: leila!.id,
      createdByUserId: createdByUserId ?? null,
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
      status: "en_attente",
      targetWaitMinutes: 60,
      waitingTimeMinutes: 24,
      queueRank: 3,
      rationaleJson: JSON.stringify([
        "Traumatisme récent sans signe vital critique.",
      ]),
      recommendedAction: "Radiographie et antalgie selon protocole.",
      protocolReference: "ESI niveau 3 simplifié",
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
      intakeMethod: patients.intakeMethod,
      preferredLanguage: patients.preferredLanguage,
      voiceTranscript: patients.voiceTranscript,
      chiefComplaint: triageCases.chiefComplaint,
      symptomSummary: triageCases.symptomSummary,
      priority: triageCases.priority,
      status: triageCases.status,
      targetWaitMinutes: triageCases.targetWaitMinutes,
      waitingTimeMinutes: triageCases.waitingTimeMinutes,
      recommendedAction: triageCases.recommendedAction,
      protocolReference: triageCases.protocolReference,
      clinicianValidation: triageCases.clinicianValidation,
      createdAt: triageCases.createdAt,
      updatedAt: triageCases.updatedAt,
    })
    .from(triageCases)
    .innerJoin(patients, eq(triageCases.patientId, patients.id))
    .where(eq(triageCases.id, triageCaseId))
    .limit(1);

  return rows[0] ?? null;
}
