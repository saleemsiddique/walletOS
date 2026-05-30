-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND');

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ticker" VARCHAR(20) NOT NULL,
    "asset_name" VARCHAR(100) NOT NULL,
    "type" "InvestmentTransactionType" NOT NULL,
    "shares" DECIMAL(18,8) NOT NULL,
    "price_per_share" DECIMAL(12,4) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "note" VARCHAR(500),
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_transactions_wallet_id_idx" ON "investment_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "investment_transactions_user_id_idx" ON "investment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "investment_transactions_ticker_idx" ON "investment_transactions"("ticker");

-- CreateIndex
CREATE INDEX "investment_transactions_date_idx" ON "investment_transactions"("date" DESC);

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
