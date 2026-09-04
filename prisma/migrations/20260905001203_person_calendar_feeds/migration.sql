-- AlterTable
ALTER TABLE "CalendarFeed" ADD COLUMN     "personId" INTEGER,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_personId_key" ON "CalendarFeed"("personId");

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data migration: personal feeds were keyed on the subscriber's user
-- account; they are now keyed on the person whose bookings they list, so
-- a person without a login can hold one too. Rows whose owner has a
-- linked person keep their token, and with it any live subscription.
UPDATE "CalendarFeed" AS cf
SET "personId" = u."personId", "userId" = NULL, "kind" = 'person'
FROM "User" AS u
WHERE cf."userId" = u."id"
  AND cf."kind" = 'personal'
  AND u."personId" IS NOT NULL;

-- What is left is a personal feed belonging to a user with no linked
-- person. Such a feed has only ever served the "geen personeelsprofiel
-- gekoppeld" placeholder event, and the new schema has no way to express
-- it, so it is dropped rather than migrated.
DELETE FROM "CalendarFeed" WHERE "kind" = 'personal';
