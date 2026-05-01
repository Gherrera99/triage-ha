-- AlterTable
ALTER TABLE `User` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `deactivatedReason` VARCHAR(191) NULL,
    ADD COLUMN `failedAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: todos los usuarios existentes deben cambiar su contraseña en el primer login.
-- Cubre los 73 usuarios cargados con contraseña inicial antes de este lote de seguridad.
UPDATE `User` SET `mustChangePassword` = true;
