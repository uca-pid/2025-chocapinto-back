/*
  Warnings:

  - You are about to drop the `_ClubMembers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `id_owner` on the `Club` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "_ClubMembers_B_index";

-- DropIndex
DROP INDEX "_ClubMembers_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ClubMembers";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "club_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "clubId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LECTOR',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "club_members_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "club_categorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ClubToClubCategoria" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ClubToClubCategoria_A_fkey" FOREIGN KEY ("A") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClubToClubCategoria_B_fkey" FOREIGN KEY ("B") REFERENCES "club_categorias" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Club" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imagen" TEXT
);
INSERT INTO "new_Club" ("description", "id", "imagen", "name") SELECT "description", "id", "imagen", "name" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "club_members_userId_clubId_key" ON "club_members"("userId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "club_categorias_nombre_key" ON "club_categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "_ClubToClubCategoria_AB_unique" ON "_ClubToClubCategoria"("A", "B");

-- CreateIndex
CREATE INDEX "_ClubToClubCategoria_B_index" ON "_ClubToClubCategoria"("B");
