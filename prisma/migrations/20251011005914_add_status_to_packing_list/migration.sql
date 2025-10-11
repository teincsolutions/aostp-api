-- CreateEnum
CREATE TYPE "public"."PackingListStatus" AS ENUM ('DRAFT', 'FINALIZED', 'POSTED');

-- AlterTable
ALTER TABLE "public"."PackingList" ADD COLUMN     "status" "public"."PackingListStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "PackingList_status_idx" ON "public"."PackingList"("status");
