-- CreateTable
CREATE TABLE "price_cache" (
    "ticker" VARCHAR(20) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "market_open" BOOLEAN NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_cache_pkey" PRIMARY KEY ("ticker")
);
