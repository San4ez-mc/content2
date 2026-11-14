-- Аватар (обличчя бренду): нова таблиця. На проді застосовувати через `prisma db execute --file` (db push заборонений).
CREATE TABLE IF NOT EXISTS "avatars" (
  "id" TEXT PRIMARY KEY,
  "project_id" TEXT NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "tagline" TEXT,
  "bio" TEXT,
  "look" TEXT,
  "base_prompt" TEXT,
  "photo_rules" TEXT,
  "video_rules" TEXT,
  "voice_rules" TEXT,
  "disclosure" TEXT,
  "ref_photo_ids" JSONB NOT NULL DEFAULT '[]',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
