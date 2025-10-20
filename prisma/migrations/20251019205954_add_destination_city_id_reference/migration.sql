/*
  Warnings:

  - You are about to drop the column `invoiceId` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCity` on the `PackingList` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[packageId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `destinationCityId` to the `PackingList` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Package" DROP CONSTRAINT "Package_invoiceId_fkey";

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "packageId" TEXT;

-- AlterTable
ALTER TABLE "public"."Package" DROP COLUMN "invoiceId";

-- AlterTable
ALTER TABLE "public"."PackingList" DROP COLUMN "destinationCity",
ADD COLUMN     "destinationCityId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_packageId_idx" ON "public"."Invoice"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_packageId_unique" ON "public"."Invoice"("packageId");

-- AddForeignKey
ALTER TABLE "public"."PackingList" ADD CONSTRAINT "PackingList_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
