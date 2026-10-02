-- Факти з датами (knowledge_entries category='fact'). Ідемпотентно; prisma db push на проді небезпечний.
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS valid_until date;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS superseded_at timestamp(3);
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS superseded_by text;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS stale_markers text;
CREATE INDEX IF NOT EXISTS knowledge_entries_project_id_category_idx ON knowledge_entries (project_id, category);
