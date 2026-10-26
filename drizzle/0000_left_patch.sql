CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`github_login` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_github_id_idx` ON `accounts` (`github_id`);--> statement-breakpoint
CREATE TABLE `article_ideas` (
	`article_id` text NOT NULL,
	`idea_id` text NOT NULL,
	PRIMARY KEY(`article_id`, `idea_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `article_languages` (
	`article_id` text NOT NULL,
	`language` text NOT NULL,
	`draft_title` text,
	`draft_summary` text,
	`draft_body` text,
	`draft_images_json` text DEFAULT '[]' NOT NULL,
	`published_title` text,
	`published_summary` text,
	`published_body` text,
	`published_images_json` text DEFAULT '[]' NOT NULL,
	`published_at` text,
	`published_updated_at` text,
	PRIMARY KEY(`article_id`, `language`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_languages_language_idx` ON `article_languages` (`language`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`idea_ids_json` text DEFAULT '[]' NOT NULL,
	`saved_at` text NOT NULL,
	`last_language` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_idx` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_objects` (
	`object_key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`byte_length` integer NOT NULL,
	`created_at` text NOT NULL,
	`unreferenced_since` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `media_objects_cleanup_idx` ON `media_objects` (`unreferenced_since`);--> statement-breakpoint
CREATE TABLE `media_references` (
	`object_key` text NOT NULL,
	`article_id` text NOT NULL,
	`language` text NOT NULL,
	`visibility` text NOT NULL,
	PRIMARY KEY(`object_key`, `article_id`, `language`, `visibility`),
	FOREIGN KEY (`object_key`) REFERENCES `media_objects`(`object_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_references_article_idx` ON `media_references` (`article_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_account_id_idx` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_entries` (
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`zh` text NOT NULL,
	`en` text NOT NULL,
	PRIMARY KEY(`kind`, `slug`)
);
