-- New creator defaults are one distinct viewer and automatic clip creation.
-- Preserve all other creator settings while upgrading existing records.
UPDATE creators
SET settings_json = json_set(
  CASE
    WHEN json_valid(settings_json) THEN settings_json
    ELSE '{"nominationCommand":"!moment","groupWindowSeconds":30,"communityContextEnabled":false}'
  END,
  '$.uniqueViewerThreshold', 1,
  '$.autoClipEnabled', json('true')
),
updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
