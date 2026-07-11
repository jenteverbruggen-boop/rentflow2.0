-- Phase 4 DDL: PersonDocument model

CREATE TABLE "PersonDocument" (
  "id" SERIAL NOT NULL,
  "personId" INTEGER NOT NULL,
  "filename" TEXT NOT NULL,
  "label" TEXT,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "PersonDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PersonDocument" ADD CONSTRAINT "PersonDocument_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
