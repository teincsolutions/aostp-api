/*
  Warnings:

  - You are about to drop the column `departureCity` on the `Container` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCity` on the `Container` table. All the data in the column will be lost.
  - You are about to drop the column `departureCityId` on the `PackingList` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCityId` on the `PackingList` table. All the data in the column will be lost.
  - Added the required column `departureCityId` to the `Container` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationCityId` to the `Container` table without a default value. This is not possible if the table is not empty.

*/

-- DropForeignKey
ALTER TABLE "public"."PackingList" DROP CONSTRAINT "PackingList_departureCityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PackingList" DROP CONSTRAINT "PackingList_destinationCityId_fkey";

-- AlterTable
ALTER TABLE "public"."Container" DROP COLUMN "departureCity",
DROP COLUMN "destinationCity",
ADD COLUMN     "departureCityId" TEXT NOT NULL DEFAULT 'dummy-accra-id' REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD COLUMN     "destinationCityId" TEXT NOT NULL DEFAULT 'dummy-shanghai-id' REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."PackingList" DROP COLUMN "departureCityId",
DROP COLUMN "destinationCityId";
