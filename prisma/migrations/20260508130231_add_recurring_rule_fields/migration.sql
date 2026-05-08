-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "autoPost" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastPostedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;
