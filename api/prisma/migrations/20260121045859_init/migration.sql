-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('NURSE_TRIAGE', 'CASHIER', 'DOCTOR', 'ADMIN', 'CONSULTOR') NOT NULL,
    `cedula` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expediente` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `age` INTEGER NULL,
    `sex` ENUM('M', 'F', 'O') NULL,
    `mayaHabla` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Patient_expediente_key`(`expediente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TriageRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `nurseId` INTEGER NOT NULL,
    `motivoUrgencia` VARCHAR(191) NOT NULL,
    `triageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `appearance` ENUM('VERDE', 'AMARILLO', 'ROJO') NOT NULL,
    `respiration` ENUM('VERDE', 'AMARILLO', 'ROJO') NOT NULL,
    `circulation` ENUM('VERDE', 'AMARILLO', 'ROJO') NOT NULL,
    `classification` ENUM('VERDE', 'AMARILLO', 'ROJO') NOT NULL,
    `paidStatus` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TriageRecord_triageAt_idx`(`triageAt`),
    INDEX `TriageRecord_classification_idx`(`classification`),
    INDEX `TriageRecord_paidStatus_idx`(`paidStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `triageId` INTEGER NOT NULL,
    `cashierId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PAID',
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_triageId_key`(`triageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicalNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `triageId` INTEGER NOT NULL,
    `doctorId` INTEGER NOT NULL,
    `consultationStartedAt` DATETIME(3) NULL,
    `padecimientoActual` TEXT NOT NULL,
    `antecedentes` TEXT NOT NULL,
    `exploracionFisica` TEXT NOT NULL,
    `estudiosParaclinicos` TEXT NOT NULL,
    `diagnostico` TEXT NOT NULL,
    `diagnosisPrincipal` VARCHAR(191) NULL,
    `planTratamiento` TEXT NOT NULL,
    `vigilancia` JSON NULL,
    `contrarreferencia` TEXT NOT NULL,
    `pronostico` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MedicalNote_triageId_key`(`triageId`),
    INDEX `MedicalNote_consultationStartedAt_idx`(`consultationStartedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TriageRecord` ADD CONSTRAINT `TriageRecord_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TriageRecord` ADD CONSTRAINT `TriageRecord_nurseId_fkey` FOREIGN KEY (`nurseId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_triageId_fkey` FOREIGN KEY (`triageId`) REFERENCES `TriageRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_cashierId_fkey` FOREIGN KEY (`cashierId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalNote` ADD CONSTRAINT `MedicalNote_triageId_fkey` FOREIGN KEY (`triageId`) REFERENCES `TriageRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalNote` ADD CONSTRAINT `MedicalNote_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
