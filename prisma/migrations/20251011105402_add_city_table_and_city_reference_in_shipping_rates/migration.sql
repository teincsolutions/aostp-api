/*
  Warnings:

  - A unique constraint covering the columns `[shippingMode,airShippingType,cityId,effectiveFrom]` on the table `ShippingRate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cityId` to the `ShippingRate` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."ShippingRate_shippingMode_airShippingType_effectiveFrom_key";

-- AlterTable
ALTER TABLE "public"."ShippingRate" ADD COLUMN     "cityId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "City_name_idx" ON "public"."City"("name");

-- CreateIndex
CREATE INDEX "City_country_idx" ON "public"."City"("country");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_shippingMode_airShippingType_cityId_effectiveF_key" ON "public"."ShippingRate"("shippingMode", "airShippingType", "cityId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "public"."ShippingRate" ADD CONSTRAINT "ShippingRate_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
