CREATE TRIGGER media_references_require_live_object
BEFORE INSERT ON media_references
WHEN NOT EXISTS (
  SELECT 1
  FROM media_objects
  WHERE object_key = NEW.object_key
    AND deleted_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media object is unavailable');
END;
