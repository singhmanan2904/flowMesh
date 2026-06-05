-- CreateTable
CREATE TABLE "Orders" (
    "id" TEXT NOT NULL,
    "products" TEXT[],
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Orders_pkey" PRIMARY KEY ("id")
);
