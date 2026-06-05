/*
  Warnings:

  - The values [PENDING,CONFIRMED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'SHIPPING_PENDING', 'SHIPPING_COMPLETED', 'SHIPPING_FAILED', 'COMPLETED');
ALTER TABLE "Orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
COMMIT;
