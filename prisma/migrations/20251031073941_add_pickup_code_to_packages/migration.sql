/*
  Warnings:

  - A unique constraint covering the columns `[pickupCode]` on the table `Package` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "pickupCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Package_pickupCode_key" ON "public"."Package"("pickupCode");
