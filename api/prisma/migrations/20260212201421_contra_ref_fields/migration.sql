-- AlterTable
ALTER TABLE `MedicalNote` ADD COLUMN `contraRefFollowUp` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `contraRefWhen` VARCHAR(191) NULL;
