-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "public"."PackingList" ADD COLUMN     "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "Package_warehouseId_idx" ON "public"."Package"("warehouseId");

-- CreateIndex
CREATE INDEX "PackingList_warehouseId_idx" ON "public"."PackingList"("warehouseId");

-- AddForeignKey
ALTER TABLE "public"."Package" ADD CONSTRAINT "Package_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackingList" ADD CONSTRAINT "PackingList_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
