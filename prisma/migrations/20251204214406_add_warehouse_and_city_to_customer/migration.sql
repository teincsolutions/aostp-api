-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "Customer_warehouseId_idx" ON "Customer"("warehouseId");

-- CreateIndex
CREATE INDEX "Customer_cityId_idx" ON "Customer"("cityId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
