/*
  Warnings:

  - Added the required column `id_owner` to the `Club` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Club" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "id_owner" INTEGER NOT NULL,
    "imagen" TEXT
);
INSERT INTO "new_Club" ("description", "id", "imagen", "name") SELECT "description", "id", "imagen", "name" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
