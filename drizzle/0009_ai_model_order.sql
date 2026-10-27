ALTER TABLE `ai_models` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `ai_models` SET `sort_order` = rowid;
--> statement-breakpoint
UPDATE `ai_models` SET `capabilities_json` = '["chat"]';
--> statement-breakpoint
DROP TABLE `ai_defaults`;
--> statement-breakpoint
ALTER TABLE `ai_connections` DROP COLUMN `priority`;
