CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE asset_type AS ENUM ('pdf','image','text','chord','notation');

CREATE TABLE bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO roles (name) VALUES
  ('owner'),
  ('admin'),
  ('editor'),
  ('viewer');

CREATE TABLE band_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at TIMESTAMPTZ,
  UNIQUE (band_id, user_id)
);

CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_version_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (band_id, title)
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER songs_updated_at_trg
BEFORE UPDATE ON songs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE song_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  version INT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (song_id, version)
);

ALTER TABLE songs
  ADD CONSTRAINT fk_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES song_versions(id)
    ON DELETE SET NULL;

CREATE TABLE song_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_version_id UUID NOT NULL REFERENCES song_versions(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL,
  url TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_song_assets_url_content_exclusive CHECK (
    ((url IS NOT NULL)::int + (content IS NOT NULL)::int) = 1
  )
);

CREATE TABLE concerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (band_id, name, start_time),
  CONSTRAINT ck_concerts_end_after_start CHECK (
    end_time IS NULL OR end_time > start_time
  )
);

CREATE TABLE setlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
  song_version_id UUID NOT NULL REFERENCES song_versions(id),
  position INT NOT NULL,
  scheduled_start TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (concert_id, position)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID REFERENCES concerts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_song_versions_song_id ON song_versions(song_id);
CREATE INDEX idx_song_assets_song_version_id ON song_assets(song_version_id);
CREATE INDEX idx_setlist_concert_id ON setlist_items(concert_id);
CREATE INDEX idx_chat_messages_concert_id ON chat_messages(concert_id);