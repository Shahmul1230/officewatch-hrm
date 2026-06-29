-- CreateTable
CREATE TABLE "WorkPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Default Work Policy',
    "weekendDays" TEXT NOT NULL DEFAULT '5,6',
    "shiftStartTime" TEXT NOT NULL DEFAULT '08:00',
    "shiftEndTime" TEXT NOT NULL DEFAULT '17:00',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
