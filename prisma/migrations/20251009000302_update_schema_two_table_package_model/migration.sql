/*
  Warnings:

  - The values [IN_PACKING_LIST,DELIVERED] on the enum `PackageStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `containerType` to the `Container` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PackageItemStatus" AS ENUM ('RECEIVED', 'CONSOLIDATED', 'RELEASED');

-- CreateEnum
CREATE TYPE "public"."ContainerType" AS ENUM ('CONTAINER', 'BAG');

-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'DELIVERY_RELEASED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."PackageStatus_new" AS ENUM ('RECEIVED', 'CONSOLIDATED', 'IN_WAREHOUSE', 'ASSIGNED', 'SHIPPED', 'ARRIVED', 'RELEASED', 'CANCELLED');
ALTER TABLE "public"."Package" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Package" ALTER COLUMN "status" TYPE "public"."PackageStatus_new" USING ("status"::text::"public"."PackageStatus_new");
ALTER TYPE "public"."PackageStatus" RENAME TO "PackageStatus_old";
ALTER TYPE "public"."PackageStatus_new" RENAME TO "PackageStatus";
DROP TYPE "public"."PackageStatus_old";
ALTER TABLE "public"."Package" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Container" ADD COLUMN     "containerType" "public"."ContainerType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "isConsolidated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."Warehouse" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contactInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackageItem" (
    "id" TEXT NOT NULL,
    "intakeTrackingCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "cbm" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "shippingMode" "public"."ShippingMode" NOT NULL,
    "airShippingType" "public"."AirShippingType",
    "status" "public"."PackageItemStatus" NOT NULL DEFAULT 'RECEIVED',
    "intakeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageId" TEXT,

    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackageItemPhoto" (
    "id" TEXT NOT NULL,
    "packageItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "photoType" TEXT NOT NULL DEFAULT 'intake',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageItemPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackageDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "packageItemId" TEXT NOT NULL,
    "receiverName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "warehouseId" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "photos" TEXT[],
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PackageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_warehouseId_key" ON "public"."Warehouse"("warehouseId");

-- CreateIndex
CREATE INDEX "Warehouse_warehouseId_idx" ON "public"."Warehouse"("warehouseId");

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "public"."Warehouse"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PackageItem_intakeTrackingCode_key" ON "public"."PackageItem"("intakeTrackingCode");

-- CreateIndex
CREATE INDEX "PackageItem_intakeTrackingCode_idx" ON "public"."PackageItem"("intakeTrackingCode");

-- CreateIndex
CREATE INDEX "PackageItem_customerId_idx" ON "public"."PackageItem"("customerId");

-- CreateIndex
CREATE INDEX "PackageItem_warehouseId_idx" ON "public"."PackageItem"("warehouseId");

-- CreateIndex
CREATE INDEX "PackageItem_status_idx" ON "public"."PackageItem"("status");

-- CreateIndex
CREATE INDEX "PackageItem_packageId_idx" ON "public"."PackageItem"("packageId");

-- CreateIndex
CREATE INDEX "PackageItemPhoto_packageItemId_idx" ON "public"."PackageItemPhoto"("packageItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDelivery_deliveryId_key" ON "public"."PackageDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "PackageDelivery_deliveryId_idx" ON "public"."PackageDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "PackageDelivery_customerId_idx" ON "public"."PackageDelivery"("customerId");

-- CreateIndex
CREATE INDEX "PackageDelivery_invoiceId_idx" ON "public"."PackageDelivery"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDelivery_packageItemId_unique" ON "public"."PackageDelivery"("packageItemId");

-- CreateIndex
CREATE INDEX "Container_containerType_idx" ON "public"."Container"("containerType");

-- AddForeignKey
ALTER TABLE "public"."PackageItem" ADD CONSTRAINT "PackageItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageItem" ADD CONSTRAINT "PackageItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageItemPhoto" ADD CONSTRAINT "PackageItemPhoto_packageItemId_fkey" FOREIGN KEY ("packageItemId") REFERENCES "public"."PackageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageDelivery" ADD CONSTRAINT "PackageDelivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageDelivery" ADD CONSTRAINT "PackageDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageDelivery" ADD CONSTRAINT "PackageDelivery_packageItemId_fkey" FOREIGN KEY ("packageItemId") REFERENCES "public"."PackageItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageDelivery" ADD CONSTRAINT "PackageDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
