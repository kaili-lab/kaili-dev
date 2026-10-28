ALTER TABLE `ai_models` ADD COLUMN `capability` text NOT NULL DEFAULT 'chat' CHECK (`capability` IN ('chat','image','embedding'));
--> statement-breakpoint
UPDATE `ai_models` SET `capability` = CASE
  WHEN EXISTS (SELECT 1 FROM json_each(`capabilities_json`) WHERE `value` = 'chat') THEN 'chat'
  WHEN json_extract(`capabilities_json`, '$[0]') IN ('image', 'embedding') THEN json_extract(`capabilities_json`, '$[0]')
  ELSE 'chat'
END;
--> statement-breakpoint
ALTER TABLE `ai_models` DROP COLUMN `capabilities_json`;
