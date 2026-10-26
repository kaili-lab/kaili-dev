-- A cleanup tombstone closes the race between the final reference check and R2 deletion.
CREATE TRIGGER `media_references_require_active_object`
BEFORE INSERT ON `media_references`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `media_objects`
  WHERE `object_key` = NEW.`object_key` AND `deleted_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media object unavailable');
END;
--> statement-breakpoint
CREATE TRIGGER `media_references_validate_slot`
BEFORE INSERT ON `media_references`
FOR EACH ROW
WHEN NEW.`language` NOT IN ('zh', 'en')
  OR NEW.`visibility` NOT IN ('draft', 'published')
BEGIN
  SELECT RAISE(ABORT, 'invalid media reference slot');
END;
