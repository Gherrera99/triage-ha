-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `responsibleName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TriageRecord` ADD COLUMN `bloodPressure` VARCHAR(191) NULL,
    ADD COLUMN `hadPriorCareSamePathology` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasReferral` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `heartRate` INTEGER NULL,
    ADD COLUMN `heightCm` DOUBLE NULL,
    ADD COLUMN `priorCarePlace` VARCHAR(191) NULL,
    ADD COLUMN `referralPlace` VARCHAR(191) NULL,
    ADD COLUMN `respiratoryRate` INTEGER NULL,
    ADD COLUMN `temperatureC` DOUBLE NULL,
    ADD COLUMN `weightKg` DOUBLE NULL;
