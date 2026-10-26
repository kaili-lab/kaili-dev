PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__backup_article_languages` AS SELECT * FROM `article_languages`;--> statement-breakpoint
CREATE TABLE `__backup_article_ideas` AS SELECT * FROM `article_ideas`;--> statement-breakpoint
CREATE TABLE `__backup_media_references` AS SELECT * FROM `media_references`;--> statement-breakpoint
CREATE TABLE `__new_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text,
	`category` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`idea_ids_json` text DEFAULT '[]' NOT NULL,
	`saved_at` text NOT NULL,
	`last_language` text
);
--> statement-breakpoint
INSERT INTO `__new_articles`("id", "slug", "category", "tags_json", "idea_ids_json", "saved_at", "last_language") SELECT "id", "slug", "category", "tags_json", "idea_ids_json", "saved_at", "last_language" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
INSERT INTO `article_languages` SELECT * FROM `__backup_article_languages`;--> statement-breakpoint
INSERT INTO `article_ideas` SELECT * FROM `__backup_article_ideas`;--> statement-breakpoint
INSERT INTO `media_references` SELECT * FROM `__backup_media_references`;--> statement-breakpoint
DROP TABLE `__backup_article_languages`;--> statement-breakpoint
DROP TABLE `__backup_article_ideas`;--> statement-breakpoint
DROP TABLE `__backup_media_references`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_idx` ON `articles` (`slug`);--> statement-breakpoint
ALTER TABLE `article_languages` ADD `published_category` text;--> statement-breakpoint
ALTER TABLE `article_languages` ADD `published_tags_json` text DEFAULT '[]' NOT NULL;