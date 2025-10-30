/*
  Warnings:

  - You are about to drop the column `shippingRateId` on the `Package` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Package" DROP COLUMN "shippingRateId",
ADD COLUMN     "shippingRate" DOUBLE PRECISION;
