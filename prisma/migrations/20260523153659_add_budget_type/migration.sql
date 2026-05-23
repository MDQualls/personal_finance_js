-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('SPENDING_LIMIT', 'SAVINGS_GOAL');

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "budgetType" "BudgetType" NOT NULL DEFAULT 'SPENDING_LIMIT';
