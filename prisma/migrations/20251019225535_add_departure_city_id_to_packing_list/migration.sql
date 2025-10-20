-- AlterTable
ALTER TABLE "public"."PackingList" ADD COLUMN     "departureCityId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."PackingList" ADD CONSTRAINT "PackingList_departureCityId_fkey" FOREIGN KEY ("departureCityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
