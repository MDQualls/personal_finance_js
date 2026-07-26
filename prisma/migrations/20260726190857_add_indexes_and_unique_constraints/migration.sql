-- CreateIndex
CREATE INDEX "Budget_categoryId_period_idx" ON "Budget"("categoryId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "Category"("name", "parentId");

-- CreateIndex
CREATE INDEX "RecurringRule_nextDate_idx" ON "RecurringRule"("nextDate");

-- CreateIndex
CREATE INDEX "Subscription_nextDueDate_idx" ON "Subscription"("nextDueDate");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_deletedAt_isTransfer_needsReview_idx" ON "Transaction"("deletedAt", "isTransfer", "needsReview");

-- Hand-added: Prisma's schema DSL can't express partial/filtered unique indexes.
-- Postgres treats each NULL as distinct, so the plain @@unique([name, parentId])
-- above does NOT stop two top-level (parentId IS NULL) categories from sharing a
-- name — which is exactly the case Plaid's resolveCategoryId() and the AI insights
-- category aggregation rely on being unambiguous. Verified before writing this
-- migration: 0 existing case-insensitive duplicate names among top-level categories.
CREATE UNIQUE INDEX "Category_name_top_level_key" ON "Category" (LOWER("name")) WHERE "parentId" IS NULL;

-- Hand-added: prevents two simultaneous *active* budgets for the same category+period
-- without permanently blocking recreation after a budget is archived (isActive: false).
-- Verified before writing this migration: 0 existing duplicate (categoryId, period)
-- pairs among active budgets.
CREATE UNIQUE INDEX "Budget_categoryId_period_active_key" ON "Budget" ("categoryId", "period") WHERE "isActive" = true;
