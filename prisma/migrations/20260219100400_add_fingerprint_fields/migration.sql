-- AlterTable: Add fingerprint authentication support
ALTER TABLE "User" ADD COLUMN "biometricType" TEXT DEFAULT 'face';
ALTER TABLE "User" ADD COLUMN "fingerprintCredential" TEXT;
ALTER TABLE "User" ADD COLUMN "fingerprintPublicKey" TEXT;
