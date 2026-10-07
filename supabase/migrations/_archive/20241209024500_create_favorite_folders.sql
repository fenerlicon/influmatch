-- Create favorite_lists table
CREATE TABLE IF NOT EXISTS public.favorite_lists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for favorite_lists
ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Brands can manage their own lists
CREATE POLICY "Brands can manage their own favorite lists"
  ON public.favorite_lists
  FOR ALL
  USING (auth.uid() = brand_id)
  WITH CHECK (auth.uid() = brand_id);

-- Update favorites table to include list_id (optional)
-- First, ensure favorites table exists (it should, but just in case)
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(brand_id, influencer_id)
);

-- Add list_id column to favorites
ALTER TABLE public.favorites 
ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.favorite_lists(id) ON DELETE SET NULL;

-- Note: Depending on logic, a favorite might belong to NO list (default 'Favorites') or ONE specific list.
-- If we want "Playlist" style where one song can be in multiple playlists, then we need a many-to-many table `favorite_list_items`.
-- However, user said "Klasörleme" (Folder-ing), which usually implies one item -> one folder (or main list).
-- But "Playlist" implies one song -> multiple playlists.
-- Let's stick to simple "Folder" logic first (1 item -> 1 folder OR 1 item -> Main Favorites + Optional Link).
-- Actually, easiest is: `favorites` is the master list. `favorite_list_items` links favorite -> list.
-- BUT, typically "Add to List" just creates a record in `favorites` with a `list_id`. 
-- If I want an influencer in multiple lists, I would need multiple records or a join table.
-- Given the "Unique(brand_id, influencer_id)" constraint above, a user can only favorite an influencer ONCE globally.
-- So to support "Folders", I must allow multiple entries OR use a join table.
-- LET'S CHANGE STRATEGY: 
-- 1. `favorites` table remains as "All Liked Influencers".
-- 2. `favorite_lists` table for folder names.
-- 3. `favorite_list_items` table (list_id, influencer_id). 
--    OR just remove the unique constraint on favorites and add list_id as part of unique?
--    Unique(brand_id, influencer_id, list_id) would allow adding same person to "Summer" and "Winter" lists.
--    This is the "Playlist" model.
--    Let's go with this: Drop old unique constraint, add new one including list_id.

-- Drop old constraint if exists (name might vary, so we try generic command or assume standard naming)
-- ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_brand_id_influencer_id_key;

-- Actually, simpler approach for MVP:
-- Keep `favorites` as global "Likes".
-- Create `favorite_folders` for folder names.
-- Create `favorite_folder_items` to map folder_id -> influencer_id.
-- This keeps the "Heart" icon simple (is favorited or not) and "Add to Folder" as separate action.
-- BUT user wants "Favori Listeleri". 
-- Let's stick to: A link belongs to a list. defaults to 'Default' list if null.
-- So I will DROP the unique constraint and make it (brand_id, influencer_id, list_id) unique.
-- Wait, if list_id is NULL, then unique(brand_id, influencer_id) covers the 'default' case.
-- If list_id is 'uuid-1', then unique(brand_id, influencer_id, 'uuid-1') covers that list.
-- So I need to change the unique constraint.

ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_brand_id_influencer_id_key;

-- access exclusive lock might be needed, but usually fine.
-- Re-add constraint with list_id. However, NULL values in unique indexes are treated as distinct in SQL standard (setup dependent).
-- Postgres: NULLs are distinct. So (1, 1, NULL) and (1, 1, NULL) can coexist? Yes.
-- So we need a partial index for the NULL case OR just ensure list_id is never null (use a 'default' list created for every user).
-- OR just use a separate table for lists.

-- Let's go with Separate Table `favorite_list_items` approach. It's cleanest/safest without messing up existing `favorites` table which might be used elsewhere.
-- Users/favorites -> Global "Heart" (Favorited).
-- Users/favorite_lists -> "Folders".
-- Users/favorite_list_items -> "Items in Folder".
-- This allows "Hearting" someone without putting them in a folder. And putting them in multiple folders.
-- This matches "Spotify" (Like song vs Add to Playlist).

CREATE TABLE IF NOT EXISTS public.favorite_list_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id uuid NOT NULL REFERENCES public.favorite_lists(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(list_id, influencer_id)
);

ALTER TABLE public.favorite_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands can manage their list items"
  ON public.favorite_list_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.favorite_lists fl 
      WHERE fl.id = favorite_list_items.list_id 
      AND fl.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.favorite_lists fl 
      WHERE fl.id = favorite_list_items.list_id 
      AND fl.brand_id = auth.uid()
    )
  );
