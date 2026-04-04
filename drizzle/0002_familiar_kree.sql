CREATE TABLE `patientFormLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int,
	`label` varchar(120) NOT NULL,
	`token` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patientFormLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `patientFormLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `staffingSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int,
	`doctorsOnDuty` int NOT NULL DEFAULT 1,
	`nursesOnDuty` int NOT NULL DEFAULT 1,
	`availableDoctors` int NOT NULL DEFAULT 1,
	`availableNurses` int NOT NULL DEFAULT 1,
	`waitingPatients` int NOT NULL DEFAULT 0,
	`activeCriticalPatients` int NOT NULL DEFAULT 0,
	`occupancyPressureScore` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffingSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `triageEvents` MODIFY COLUMN `eventType` enum('creation','priority_update','status_update','notification','note','resource_update','manual_override') NOT NULL;--> statement-breakpoint
ALTER TABLE `patients` ADD `formLinkId` int;--> statement-breakpoint
ALTER TABLE `patients` ADD `intakeSource` enum('staff_full','patient_qr') DEFAULT 'staff_full' NOT NULL;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `staffingSnapshotId` int;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `aiRecommendedPriority` enum('urgence_vitale','urgence','semi_urgence','non_urgent');--> statement-breakpoint
ALTER TABLE `triageCases` ADD `entryMode` enum('standard_ai','manual_p1','manual_staff') DEFAULT 'standard_ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `manualPriorityOverride` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `manualPriorityReason` text;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `skipAiAnalysis` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `queuePressureScore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `triageCases` ADD `aiSummaryJson` json;--> statement-breakpoint
ALTER TABLE `patientFormLinks` ADD CONSTRAINT `patientFormLinks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffingSnapshots` ADD CONSTRAINT `staffingSnapshots_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patients` ADD CONSTRAINT `patients_formLinkId_patientFormLinks_id_fk` FOREIGN KEY (`formLinkId`) REFERENCES `patientFormLinks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `triageCases` ADD CONSTRAINT `triageCases_staffingSnapshotId_staffingSnapshots_id_fk` FOREIGN KEY (`staffingSnapshotId`) REFERENCES `staffingSnapshots`(`id`) ON DELETE no action ON UPDATE no action;