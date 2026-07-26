-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isSavings" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration: retroactively flag the existing "Savings & Investments" system category so it's
-- excluded from expense reports without waiting on prisma db seed to re-run (seed only sets fields on create, never on update).
UPDATE "Category" SET "isSavings" = true WHERE "name" = 'Savings & Investments';
