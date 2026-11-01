-- Icerik plani kapaklari (/toplanti, 2026-11-02). Eklemeli degisiklik: bir kolon ve ozel bir kova. DROP yok, veri degisikligi yok.
-- Kovanin politikasi yok: yukleme sunucunun imzali adresiyle, okuma sunucunun imzali baglantisiyla (lib/content-plan.ts).
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS cover_path text CHECK (cover_path IS NULL OR char_length(cover_path) <= 200);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-covers', 'content-covers', false, 5242880, '{image/png,image/jpeg,image/webp}')
ON CONFLICT (id) DO NOTHING;
