ALTER TABLE `articles` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `articles` ADD `write_token` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `articles_require_live_taxonomy_insert`
BEFORE INSERT ON `articles`
WHEN (
  NEW.`category` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'categories' AND `slug` = NEW.`category`
  )
) OR EXISTS (
  SELECT 1 FROM json_each(NEW.`tags_json`) AS requested
  WHERE NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'tags' AND `slug` = requested.value
  )
)
BEGIN
  SELECT RAISE(ABORT, 'article taxonomy is unavailable');
END;
--> statement-breakpoint
CREATE TRIGGER `articles_require_live_taxonomy_update`
BEFORE UPDATE OF `category`, `tags_json` ON `articles`
WHEN (
  NEW.`category` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'categories' AND `slug` = NEW.`category`
  )
) OR EXISTS (
  SELECT 1 FROM json_each(NEW.`tags_json`) AS requested
  WHERE NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'tags' AND `slug` = requested.value
  )
)
BEGIN
  SELECT RAISE(ABORT, 'article taxonomy is unavailable');
END;
--> statement-breakpoint
CREATE TRIGGER `article_languages_require_live_taxonomy`
BEFORE INSERT ON `article_languages`
WHEN (
  NEW.`published_category` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'categories' AND `slug` = NEW.`published_category`
  )
) OR EXISTS (
  SELECT 1 FROM json_each(NEW.`published_tags_json`) AS requested
  WHERE NOT EXISTS (
    SELECT 1 FROM `taxonomy_entries`
    WHERE `kind` = 'tags' AND `slug` = requested.value
  )
)
BEGIN
  SELECT RAISE(ABORT, 'published taxonomy is unavailable');
END;
--> statement-breakpoint
CREATE TRIGGER `taxonomy_entries_restrict_delete`
BEFORE DELETE ON `taxonomy_entries`
WHEN (
  OLD.`kind` = 'categories'
  AND (
    EXISTS (SELECT 1 FROM `articles` WHERE `category` = OLD.`slug`)
    OR EXISTS (
      SELECT 1 FROM `article_languages`
      WHERE `published_category` = OLD.`slug`
    )
  )
) OR (
  OLD.`kind` = 'tags'
  AND (
    EXISTS (
      SELECT 1 FROM `articles`, json_each(`articles`.`tags_json`) AS used
      WHERE used.value = OLD.`slug`
    )
    OR EXISTS (
      SELECT 1
      FROM `article_languages`, json_each(`article_languages`.`published_tags_json`) AS used
      WHERE used.value = OLD.`slug`
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'taxonomy entry is referenced');
END;
