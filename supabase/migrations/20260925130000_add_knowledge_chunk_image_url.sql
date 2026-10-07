-- Adds a single nullable image URL to knowledge_chunks, the same
-- "minimal justified column, not a new table" pattern as messages.activity_id
-- (see 20260924233836_add_activity_reference_and_feedback.sql). Only
-- brincadeiras/materiais rows are expected to ever have one populated, but
-- the column lives on knowledge_chunks itself rather than a side table
-- because it's a 1:1 property of the chunk, not a relationship.
--
-- Population is a data concern, not schema, so it isn't part of this
-- migration — see scripts/knowledge-base/sync_activity_images.py.
alter table public.knowledge_chunks
  add column image_url text;
