-- EEMUA 191 rationalization fields: every alert rule documents its owner,
-- the required operator action, and the response window in minutes.
ALTER TABLE "AlertRule" ADD COLUMN "owner" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AlertRule" ADD COLUMN "responseAction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AlertRule" ADD COLUMN "windowMinutes" INTEGER NOT NULL DEFAULT 1440;
