CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int,
	`intakeMethod` enum('ocr','manuel','vocal') NOT NULL,
	`firstName` varchar(120) NOT NULL,
	`lastName` varchar(120) NOT NULL,
	`dateOfBirth` varchar(32) NOT NULL,
	`socialSecurityNumberMasked` varchar(32) NOT NULL,
	`socialSecurityNumberHash` varchar(128) NOT NULL,
	`identitySourceUrl` text,
	`voiceTranscript` text,
	`preferredLanguage` varchar(32) NOT NULL DEFAULT 'fr',
	`mobileNumber` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triageCaseId` int,
	`severity` enum('info','urgent','critical') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`delivered` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `triageCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`createdByUserId` int,
	`chiefComplaint` varchar(255) NOT NULL,
	`symptomSummary` text NOT NULL,
	`painLevel` int NOT NULL,
	`canWalk` boolean NOT NULL DEFAULT true,
	`hasBleeding` boolean NOT NULL DEFAULT false,
	`hasSevereBleeding` boolean NOT NULL DEFAULT false,
	`hasBreathingDifficulty` boolean NOT NULL DEFAULT false,
	`hasChestPain` boolean NOT NULL DEFAULT false,
	`hasNeurologicalDeficit` boolean NOT NULL DEFAULT false,
	`hasLossOfConsciousness` boolean NOT NULL DEFAULT false,
	`hasHighFever` boolean NOT NULL DEFAULT false,
	`hasTrauma` boolean NOT NULL DEFAULT false,
	`isPregnant` boolean NOT NULL DEFAULT false,
	`oxygenSaturation` int,
	`heartRate` int,
	`respiratoryRate` int,
	`systolicBloodPressure` int,
	`priority` enum('urgence_vitale','urgence','semi_urgence','non_urgent') NOT NULL,
	`status` enum('en_attente','en_cours','oriente','termine') NOT NULL DEFAULT 'en_attente',
	`targetWaitMinutes` int NOT NULL,
	`waitingTimeMinutes` int NOT NULL DEFAULT 0,
	`queueRank` int NOT NULL,
	`rationaleJson` json,
	`recommendedAction` text NOT NULL,
	`protocolReference` varchar(120) NOT NULL,
	`clinicianValidation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `triageCases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `triageEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triageCaseId` int NOT NULL,
	`eventType` enum('creation','priority_update','status_update','notification','note') NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`eventPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `triageEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patients` ADD CONSTRAINT `patients_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffNotifications` ADD CONSTRAINT `staffNotifications_triageCaseId_triageCases_id_fk` FOREIGN KEY (`triageCaseId`) REFERENCES `triageCases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `triageCases` ADD CONSTRAINT `triageCases_patientId_patients_id_fk` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `triageCases` ADD CONSTRAINT `triageCases_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `triageEvents` ADD CONSTRAINT `triageEvents_triageCaseId_triageCases_id_fk` FOREIGN KEY (`triageCaseId`) REFERENCES `triageCases`(`id`) ON DELETE no action ON UPDATE no action;