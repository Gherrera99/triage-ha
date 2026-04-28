/*
  Warnings:

  - You are about to drop the column `vigilancia` on the `MedicalNote` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `MedicalNote` DROP COLUMN `vigilancia`,
    ADD COLUMN `vigilanciaTexto` TEXT NULL;

-- AlterTable
ALTER TABLE `TriageRecord` ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedReason` ENUM('CASHIER_FINISHED', 'REFUSED_PAYMENT', 'NO_SHOW', 'DOCTOR_FINISHED') NULL,
    ADD COLUMN `noShow` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `noShowAt` DATETIME(3) NULL,
    ADD COLUMN `noShowDoctorId` INTEGER NULL,
    ADD COLUMN `noShowReason` TEXT NULL,
    ADD COLUMN `observaciones` TEXT NULL,
    ADD COLUMN `refusedPayment` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `TriageRecord_closedAt_idx` ON `TriageRecord`(`closedAt`);

-- CreateIndex
CREATE INDEX `TriageRecord_refusedPayment_idx` ON `TriageRecord`(`refusedPayment`);

-- CreateIndex
CREATE INDEX `TriageRecord_noShow_idx` ON `TriageRecord`(`noShow`);

-- AddForeignKey
ALTER TABLE `TriageRecord` ADD CONSTRAINT `TriageRecord_noShowDoctorId_fkey` FOREIGN KEY (`noShowDoctorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
