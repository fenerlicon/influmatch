-- Fix storage bucket RLS policies for advert-hero-images
-- Note: This assumes the bucket already exists. Create it manually in Supabase Dashboard if it doesn't exist.

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update hero images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can read hero images" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload hero images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'advert-hero-images' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update hero images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'advert-hero-images' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete hero images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'advert-hero-images' AND
  auth.role() = 'authenticated'
);

-- Allow everyone to read public files
CREATE POLICY "Everyone can read hero images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'advert-hero-images'
);

