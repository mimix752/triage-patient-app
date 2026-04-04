import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const patientFormLinks = mysqlTable("patientFormLinks", {
  id: int("id").autoincrement().primaryKey(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  label: varchar("label", { length: 120 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const staffingSnapshots = mysqlTable("staffingSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  doctorsOnDuty: int("doctorsOnDuty").default(1).notNull(),
  nursesOnDuty: int("nursesOnDuty").default(1).notNull(),
  availableDoctors: int("availableDoctors").default(1).notNull(),
  availableNurses: int("availableNurses").default(1).notNull(),
  waitingPatients: int("waitingPatients").default(0).notNull(),
  activeCriticalPatients: int("activeCriticalPatients").default(0).notNull(),
  occupancyPressureScore: int("occupancyPressureScore").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  formLinkId: int("formLinkId").references(() => patientFormLinks.id),
  intakeMethod: mysqlEnum("intakeMethod", ["ocr", "manuel", "vocal"]).notNull(),
  intakeSource: mysqlEnum("intakeSource", ["staff_full", "patient_qr"]).default("staff_full").notNull(),
  firstName: varchar("firstName", { length: 120 }).notNull(),
  lastName: varchar("lastName", { length: 120 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 32 }).notNull(),
  socialSecurityNumberMasked: varchar("socialSecurityNumberMasked", { length: 32 }).notNull(),
  socialSecurityNumberHash: varchar("socialSecurityNumberHash", { length: 128 }).notNull(),
  identitySourceUrl: text("identitySourceUrl"),
  voiceTranscript: text("voiceTranscript"),
  preferredLanguage: varchar("preferredLanguage", { length: 32 }).default("fr").notNull(),
  mobileNumber: varchar("mobileNumber", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const triageCases = mysqlTable("triageCases", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull().references(() => patients.id),
  createdByUserId: int("createdByUserId").references(() => users.id),
  staffingSnapshotId: int("staffingSnapshotId").references(() => staffingSnapshots.id),
  chiefComplaint: varchar("chiefComplaint", { length: 255 }).notNull(),
  symptomSummary: text("symptomSummary").notNull(),
  painLevel: int("painLevel").notNull(),
  canWalk: boolean("canWalk").default(true).notNull(),
  hasBleeding: boolean("hasBleeding").default(false).notNull(),
  hasSevereBleeding: boolean("hasSevereBleeding").default(false).notNull(),
  hasBreathingDifficulty: boolean("hasBreathingDifficulty").default(false).notNull(),
  hasChestPain: boolean("hasChestPain").default(false).notNull(),
  hasNeurologicalDeficit: boolean("hasNeurologicalDeficit").default(false).notNull(),
  hasLossOfConsciousness: boolean("hasLossOfConsciousness").default(false).notNull(),
  hasHighFever: boolean("hasHighFever").default(false).notNull(),
  hasTrauma: boolean("hasTrauma").default(false).notNull(),
  isPregnant: boolean("isPregnant").default(false).notNull(),
  oxygenSaturation: int("oxygenSaturation"),
  heartRate: int("heartRate"),
  respiratoryRate: int("respiratoryRate"),
  systolicBloodPressure: int("systolicBloodPressure"),
  priority: mysqlEnum("priority", ["urgence_vitale", "urgence", "semi_urgence", "non_urgent"]).notNull(),
  aiRecommendedPriority: mysqlEnum("aiRecommendedPriority", ["urgence_vitale", "urgence", "semi_urgence", "non_urgent"]),
  status: mysqlEnum("status", ["en_attente", "en_cours", "oriente", "termine"]).default("en_attente").notNull(),
  entryMode: mysqlEnum("entryMode", ["standard_ai", "manual_p1", "manual_staff"]).default("standard_ai").notNull(),
  manualPriorityOverride: boolean("manualPriorityOverride").default(false).notNull(),
  manualPriorityReason: text("manualPriorityReason"),
  skipAiAnalysis: boolean("skipAiAnalysis").default(false).notNull(),
  queuePressureScore: int("queuePressureScore").default(0).notNull(),
  targetWaitMinutes: int("targetWaitMinutes").notNull(),
  waitingTimeMinutes: int("waitingTimeMinutes").default(0).notNull(),
  queueRank: int("queueRank").notNull(),
  rationaleJson: json("rationaleJson"),
  aiSummaryJson: json("aiSummaryJson"),
  recommendedAction: text("recommendedAction").notNull(),
  protocolReference: varchar("protocolReference", { length: 120 }).notNull(),
  clinicianValidation: text("clinicianValidation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const triageEvents = mysqlTable("triageEvents", {
  id: int("id").autoincrement().primaryKey(),
  triageCaseId: int("triageCaseId").notNull().references(() => triageCases.id),
  eventType: mysqlEnum("eventType", ["creation", "priority_update", "status_update", "notification", "note", "resource_update", "manual_override"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  eventPayload: json("eventPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const staffNotifications = mysqlTable("staffNotifications", {
  id: int("id").autoincrement().primaryKey(),
  triageCaseId: int("triageCaseId").references(() => triageCases.id),
  severity: mysqlEnum("severity", ["info", "urgent", "critical"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  delivered: boolean("delivered").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PatientFormLink = typeof patientFormLinks.$inferSelect;
export type InsertPatientFormLink = typeof patientFormLinks.$inferInsert;
export type StaffingSnapshot = typeof staffingSnapshots.$inferSelect;
export type InsertStaffingSnapshot = typeof staffingSnapshots.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;
export type TriageCase = typeof triageCases.$inferSelect;
export type InsertTriageCase = typeof triageCases.$inferInsert;
export type TriageEvent = typeof triageEvents.$inferSelect;
export type InsertTriageEvent = typeof triageEvents.$inferInsert;
export type StaffNotification = typeof staffNotifications.$inferSelect;
export type InsertStaffNotification = typeof staffNotifications.$inferInsert;
