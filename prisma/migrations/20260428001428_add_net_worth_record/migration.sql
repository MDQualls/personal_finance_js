-- CreateTable
CREATE TABLE "NetWorthRecord" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assets" INTEGER NOT NULL,
    "liabilities" INTEGER NOT NULL,
    "netWorth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthRecord_month_key" ON "NetWorthRecord"("month");
