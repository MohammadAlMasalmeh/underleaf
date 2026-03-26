-- Migration: Add file tree support to projects table
-- Each project now stores its files as a JSONB array instead of a single source

-- Add new columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS files jsonb;

-- Migrate existing single-file rows into the new files column
UPDATE public.projects
SET
  project_name = COALESCE(
    regexp_replace(name, '\.tex$', ''),
    'Untitled'
  ),
  files = jsonb_build_array(
    jsonb_build_object(
      'id', 'file-' || id,
      'name', name,
      'source', source,
      'updatedAt', updated_at,
      'path', '/' || name
    )
  )
WHERE files IS NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS projects_files_idx ON public.projects USING gin (files);
