-- ============================================================
-- Migration: community launch content
-- Purpose: Adds admin-managed events, readings, announcements,
--          and public guide bios for the community MVP.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text CHECK (char_length(description) <= 2000),
  event_date timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  location text CHECK (char_length(location) <= 200),
  meeting_link text CHECK (meeting_link IS NULL OR meeting_link LIKE 'https://%'),
  cover_image_url text CHECK (cover_image_url IS NULL OR cover_image_url LIKE 'https://%'),
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_community_events_updated_at'
  ) THEN
    CREATE TRIGGER trg_community_events_updated_at
    BEFORE UPDATE ON community_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END; $$;

ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_published_events" ON community_events;
CREATE POLICY "members_read_published_events"
  ON community_events FOR SELECT
  TO authenticated
  USING (
    published = true
    AND event_date > now() - INTERVAL '24 hours'
  );

DROP POLICY IF EXISTS "staff_read_all_events" ON community_events;
CREATE POLICY "staff_read_all_events"
  ON community_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'guide')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_insert_events" ON community_events;
CREATE POLICY "staff_insert_events"
  ON community_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_update_events" ON community_events;
CREATE POLICY "staff_update_events"
  ON community_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_delete_events" ON community_events;
CREATE POLICY "staff_delete_events"
  ON community_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

CREATE INDEX IF NOT EXISTS idx_community_events_published_date
  ON community_events (published, event_date DESC);

CREATE TABLE IF NOT EXISTS community_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body text CHECK (char_length(body) <= 10000),
  external_url text CHECK (external_url IS NULL OR external_url LIKE 'https://%'),
  category text NOT NULL DEFAULT 'General'
    CHECK (category IN ('Faith', 'Relationships', 'Community', 'General')),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reading_has_content CHECK (
    body IS NOT NULL OR external_url IS NOT NULL
  )
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_community_readings_updated_at'
  ) THEN
    CREATE TRIGGER trg_community_readings_updated_at
    BEFORE UPDATE ON community_readings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION set_reading_published_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.published = true AND OLD.published = false THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reading_published_at'
  ) THEN
    CREATE TRIGGER trg_reading_published_at
    BEFORE UPDATE ON community_readings
    FOR EACH ROW EXECUTE FUNCTION set_reading_published_at();
  END IF;
END; $$;

ALTER TABLE community_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_published_readings" ON community_readings;
CREATE POLICY "members_read_published_readings"
  ON community_readings FOR SELECT
  TO authenticated
  USING (published = true);

DROP POLICY IF EXISTS "staff_read_all_readings" ON community_readings;
CREATE POLICY "staff_read_all_readings"
  ON community_readings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'guide')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_insert_readings" ON community_readings;
CREATE POLICY "staff_insert_readings"
  ON community_readings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_update_readings" ON community_readings;
CREATE POLICY "staff_update_readings"
  ON community_readings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_delete_readings" ON community_readings;
CREATE POLICY "staff_delete_readings"
  ON community_readings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

CREATE INDEX IF NOT EXISTS idx_community_readings_published_date
  ON community_readings (published, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_community_readings_category
  ON community_readings (category) WHERE published = true;

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  tone text NOT NULL DEFAULT 'info'
    CHECK (tone IN ('info', 'celebration', 'reminder', 'alert')),
  published boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_announcements_updated_at'
  ) THEN
    CREATE TRIGGER trg_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END; $$;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_active_announcements" ON announcements;
CREATE POLICY "members_read_active_announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    published = true
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "staff_read_all_announcements" ON announcements;
CREATE POLICY "staff_read_all_announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'guide')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_insert_announcements" ON announcements;
CREATE POLICY "staff_insert_announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_update_announcements" ON announcements;
CREATE POLICY "staff_update_announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

DROP POLICY IF EXISTS "staff_delete_announcements" ON announcements;
CREATE POLICY "staff_delete_announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
      AND profiles.suspended = false
    )
  );

CREATE INDEX IF NOT EXISTS idx_announcements_feed
  ON announcements (pinned DESC, created_at DESC)
  WHERE published = true;

ALTER TABLE guide_profiles
  ADD COLUMN IF NOT EXISTS bio text
  CHECK (bio IS NULL OR char_length(bio) <= 600);
