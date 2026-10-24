-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AUCTIONEER', 'BIDDER');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CAPTURED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('INITIAL_CREDIT', 'ADJUSTMENT', 'AUCTION_PAYMENT', 'AUCTION_RECEIPT', 'REFUND');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "auctioneerId" UUID NOT NULL,
    "winningBidderId" UUID,
    "externalItemId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "initialPriceInCents" BIGINT NOT NULL,
    "minimumIncrementInCents" BIGINT NOT NULL,
    "currentPriceInCents" BIGINT,
    "status" "LotStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "bidderId" UUID NOT NULL,
    "amountInCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balanceInCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletHold" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "bidId" UUID NOT NULL,
    "amountInCents" BIGINT NOT NULL,
    "status" "WalletHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountInCents" BIGINT NOT NULL,
    "referenceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "winnerId" UUID NOT NULL,
    "auctioneerId" UUID NOT NULL,
    "amountInCents" BIGINT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "publicToken" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "previousHash" VARCHAR(64),
    "hash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Lot_status_endsAt_idx" ON "Lot"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Lot_auctioneerId_createdAt_idx" ON "Lot"("auctioneerId", "createdAt");

-- CreateIndex
CREATE INDEX "Lot_externalSource_externalItemId_idx" ON "Lot"("externalSource", "externalItemId");

-- CreateIndex
CREATE INDEX "Bid_lotId_createdAt_idx" ON "Bid"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_bidderId_createdAt_idx" ON "Bid"("bidderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletHold_bidId_key" ON "WalletHold"("bidId");

-- CreateIndex
CREATE INDEX "WalletHold_userId_status_idx" ON "WalletHold"("userId", "status");

-- CreateIndex
CREATE INDEX "WalletHold_lotId_status_idx" ON "WalletHold"("lotId", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_lotId_key" ON "Settlement"("lotId");

-- CreateIndex
CREATE INDEX "Settlement_winnerId_createdAt_idx" ON "Settlement"("winnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Settlement_auctioneerId_createdAt_idx" ON "Settlement"("auctioneerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_lotId_key" ON "Receipt"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_settlementId_key" ON "Receipt"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_publicToken_key" ON "Receipt"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntry_sequence_key" ON "AuditEntry"("sequence");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_idx" ON "AuditEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_auctioneerId_fkey" FOREIGN KEY ("auctioneerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_winningBidderId_fkey" FOREIGN KEY ("winningBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_auctioneerId_fkey" FOREIGN KEY ("auctioneerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure wallet balances are nonnegative
ALTER TABLE "Wallet"
ADD CONSTRAINT "Wallet_balance_nonnegative"
CHECK ("balanceInCents" >= 0);

-- Ensure bids have positive amounts
ALTER TABLE "Bid"
ADD CONSTRAINT "Bid_amount_positive"
CHECK ("amountInCents" > 0);

-- Ensure auction prices and increments are valid
ALTER TABLE "Lot"
ADD CONSTRAINT "Lot_initial_price_positive"
CHECK ("initialPriceInCents" > 0);

ALTER TABLE "Lot"
ADD CONSTRAINT "Lot_minimum_increment_positive"
CHECK ("minimumIncrementInCents" > 0);

ALTER TABLE "Lot"
ADD CONSTRAINT "Lot_current_price_nonnegative"
CHECK (
  "currentPriceInCents" IS NULL
  OR "currentPriceInCents" >= 0
);

-- Ensure reserved amounts are positive
ALTER TABLE "WalletHold"
ADD CONSTRAINT "WalletHold_amount_positive"
CHECK ("amountInCents" > 0);

-- Ensure auction date ranges are valid
ALTER TABLE "Lot"
ADD CONSTRAINT "Lot_valid_date_range"
CHECK (
  "startsAt" IS NULL
  OR "endsAt" IS NULL
  OR "endsAt" > "startsAt"
);

-- Allow only one active reservation per auction lot
CREATE UNIQUE INDEX "WalletHold_one_active_per_lot"
ON "WalletHold" ("lotId")
WHERE "status" = 'ACTIVE'::"WalletHoldStatus";
