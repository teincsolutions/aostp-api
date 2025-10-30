-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "destinationCityId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Package" ADD CONSTRAINT "Package_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
