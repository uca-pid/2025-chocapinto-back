-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT
);

-- CreateTable
CREATE TABLE "_ClubBooks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ClubBooks_A_fkey" FOREIGN KEY ("A") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClubBooks_B_fkey" FOREIGN KEY ("B") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ClubBooks_AB_unique" ON "_ClubBooks"("A", "B");

-- CreateIndex
CREATE INDEX "_ClubBooks_B_index" ON "_ClubBooks"("B");
