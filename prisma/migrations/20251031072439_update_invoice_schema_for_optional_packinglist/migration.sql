-- DropForeignKey
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_packingListId_fkey";

-- AlterTable
ALTER TABLE "public"."Invoice" ALTER COLUMN "packingListId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_packingListId_fkey" FOREIGN KEY ("packingListId") REFERENCES "public"."PackingList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
