-- CreateTable
CREATE TABLE "DismissedTransferCandidate" (
    "id" TEXT NOT NULL,
    "fromTransactionId" TEXT NOT NULL,
    "toTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedTransferCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedTransferCandidate_fromTransactionId_toTransactionI_key" ON "DismissedTransferCandidate"("fromTransactionId", "toTransactionId");
