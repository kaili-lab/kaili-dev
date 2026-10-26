DROP TRIGGER IF EXISTS article_languages_require_live_taxonomy;
--> statement-breakpoint
CREATE TRIGGER `article_languages_require_live_taxonomy`
BEFORE INSERT ON `article_languages`
WHEN NEW.`withdrawn_at` IS NULL AND (
  (
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
)
BEGIN
  SELECT RAISE(ABORT, 'published taxonomy is unavailable');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS media_references_validate_slot;
--> statement-breakpoint
CREATE TRIGGER `media_references_validate_slot`
BEFORE INSERT ON `media_references`
FOR EACH ROW
WHEN NEW.`language` NOT IN ('zh', 'en')
  OR NEW.`visibility` NOT IN ('draft', 'published', 'withdrawn')
BEGIN
  SELECT RAISE(ABORT, 'invalid media reference slot');
END;
