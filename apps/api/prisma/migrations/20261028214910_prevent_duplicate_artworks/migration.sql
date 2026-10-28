/*
  Warnings:

  - A unique constraint covering the columns `[externalSource,externalItemId]` on the table `Lot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Lot_externalSource_externalItemId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Lot_externalSource_externalItemId_key" ON "Lot"("externalSource", "externalItemId");
