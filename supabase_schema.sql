-- ========================================================
-- MySignage Supabase Setup Schema
-- Run this script in your Supabase SQL Editor
-- ========================================================

-- 1. Create Playlists Table
CREATE TABLE IF NOT EXISTS public.mysignage_playlists (
  id TEXT PRIMARY KEY, -- 'landscape' or 'portrait'
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Configs Table
CREATE TABLE IF NOT EXISTS public.mysignage_configs (
  id TEXT PRIMARY KEY, -- 'landscape' or 'portrait'
  playback_mode TEXT NOT NULL DEFAULT 'playlist',
  freeze_index INT NOT NULL DEFAULT 0,
  image_fit TEXT NOT NULL DEFAULT 'contain',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & add public access policies
ALTER TABLE public.mysignage_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mysignage_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Playlists" ON public.mysignage_playlists;
CREATE POLICY "Public Read Playlists" ON public.mysignage_playlists FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Write Playlists" ON public.mysignage_playlists;
CREATE POLICY "Public Write Playlists" ON public.mysignage_playlists FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Configs" ON public.mysignage_configs;
CREATE POLICY "Public Read Configs" ON public.mysignage_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Write Configs" ON public.mysignage_configs;
CREATE POLICY "Public Write Configs" ON public.mysignage_configs FOR ALL USING (true) WITH CHECK (true);

-- 3. Enable Realtime replication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- 4. Create Public Storage Bucket for Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('mysignage_uploads', 'mysignage_uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public access to storage bucket
DROP POLICY IF EXISTS "Public Storage Read" ON storage.objects;
CREATE POLICY "Public Storage Read" ON storage.objects FOR SELECT USING (bucket_id = 'mysignage_uploads');

DROP POLICY IF EXISTS "Public Storage Insert" ON storage.objects;
CREATE POLICY "Public Storage Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mysignage_uploads');

DROP POLICY IF EXISTS "Public Storage Delete" ON storage.objects;
CREATE POLICY "Public Storage Delete" ON storage.objects FOR DELETE USING (bucket_id = 'mysignage_uploads');
