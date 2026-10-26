DROP TRIGGER IF EXISTS taxonomy_entries_restrict_delete;
--> statement-breakpoint
CREATE TRIGGER `taxonomy_entries_restrict_delete`
BEFORE DELETE ON `taxonomy_entries`
WHEN (
  OLD.`kind` = 'categories'
  AND (
    EXISTS (SELECT 1 FROM `articles` WHERE `category` = OLD.`slug`)
    OR EXISTS (
      SELECT 1 FROM `article_languages`
      WHERE `published_category` = OLD.`slug` AND `withdrawn_at` IS NULL
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
      WHERE used.value = OLD.`slug` AND `withdrawn_at` IS NULL
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'taxonomy entry is referenced');
END;
