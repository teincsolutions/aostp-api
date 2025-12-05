/*
  Warnings:

  - You are about to drop the column `packageItemId` on the `PackageDelivery` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[packageId]` on the table `PackageDelivery` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `packageId` to the `PackageDelivery` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PackageDelivery" DROP CONSTRAINT "PackageDelivery_packageItemId_fkey";

-- DropIndex
DROP INDEX "public"."PackageDelivery_packageItemId_unique";

-- AlterTable
ALTER TABLE "PackageDelivery" DROP COLUMN "packageItemId",
ADD COLUMN     "packageId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PackageDelivery_packageId_idx" ON "PackageDelivery"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDelivery_packageId_unique" ON "PackageDelivery"("packageId");

-- AddForeignKey
ALTER TABLE "PackageDelivery" ADD CONSTRAINT "PackageDelivery_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
