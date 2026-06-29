-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Screenshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "pcName" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" DATETIME,
    "expiresAt" DATETIME,
    CONSTRAINT "Screenshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Screenshot" ("capturedAt", "employeeId", "id", "imageUrl", "pcName") SELECT "capturedAt", "employeeId", "id", "imageUrl", "pcName" FROM "Screenshot";
DROP TABLE "Screenshot";
ALTER TABLE "new_Screenshot" RENAME TO "Screenshot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
