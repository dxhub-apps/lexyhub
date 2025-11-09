-- Migration: Feedback System
-- Description: Create feedback table with RLS policies for user feedback and admin management

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_plan text,
  type text NOT NULL CHECK (type IN ('bug', 'idea', 'question', 'other', 'rating')),
  title text,
  message text,
  rating int CHECK (rating >= 1 AND rating <= 5),
  page_url text,
  app_section text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'planned', 'done', 'rejected')),
  impact text CHECK (impact IN ('low', 'medium', 'high')),
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  screenshot_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_note text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback (status);
CREATE INDEX IF NOT EXISTS feedback_type_idx ON public.feedback (type);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_plan_idx ON public.feedback (user_plan);

-- Create function to check if current user is admin
-- Mirrors the logic from src/lib/auth/admin.ts
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
DECLARE
  current_user_id uuid;
  user_app_metadata jsonb;
  user_metadata jsonb;
  user_plan text;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user metadata from auth.users
  SELECT
    raw_app_meta_data,
    raw_user_meta_data
  INTO
    user_app_metadata,
    user_metadata
  FROM auth.users
  WHERE id = current_user_id;

  -- Check app_metadata for admin indicators
  IF user_app_metadata IS NOT NULL THEN
    -- Check is_admin, admin, isAdmin as boolean or string 'true'
    IF (user_app_metadata->>'is_admin') IN ('true', '1', 'yes', 'admin') OR
       (user_app_metadata->>'admin') IN ('true', '1', 'yes', 'admin') OR
       (user_app_metadata->>'isAdmin') IN ('true', '1', 'yes', 'admin') OR
       (user_app_metadata->'is_admin')::text = 'true' OR
       (user_app_metadata->'admin')::text = 'true' OR
       (user_app_metadata->'isAdmin')::text = 'true' THEN
      RETURN true;
    END IF;

    -- Check role field
    IF LOWER(user_app_metadata->>'role') IN ('admin', 'administrator') THEN
      RETURN true;
    END IF;

    -- Check roles array
    IF user_app_metadata->'roles' IS NOT NULL AND
       user_app_metadata->'roles' @> '"admin"'::jsonb THEN
      RETURN true;
    END IF;

    -- Check permissions array
    IF user_app_metadata->'permissions' IS NOT NULL AND
       user_app_metadata->'permissions' @> '"admin"'::jsonb THEN
      RETURN true;
    END IF;
  END IF;

  -- Check user_metadata (raw_user_meta_data) for admin indicators
  IF user_metadata IS NOT NULL THEN
    -- Check is_admin, admin, isAdmin as boolean or string 'true'
    IF (user_metadata->>'is_admin') IN ('true', '1', 'yes', 'admin') OR
       (user_metadata->>'admin') IN ('true', '1', 'yes', 'admin') OR
       (user_metadata->>'isAdmin') IN ('true', '1', 'yes', 'admin') OR
       (user_metadata->'is_admin')::text = 'true' OR
       (user_metadata->'admin')::text = 'true' OR
       (user_metadata->'isAdmin')::text = 'true' THEN
      RETURN true;
    END IF;

    -- Check role field
    IF LOWER(user_metadata->>'role') IN ('admin', 'administrator') THEN
      RETURN true;
    END IF;

    -- Check roles array
    IF user_metadata->'roles' IS NOT NULL AND
       user_metadata->'roles' @> '"admin"'::jsonb THEN
      RETURN true;
    END IF;

    -- Check permissions array
    IF user_metadata->'permissions' IS NOT NULL AND
       user_metadata->'permissions' @> '"admin"'::jsonb THEN
      RETURN true;
    END IF;
  END IF;

  -- Check plan in user_profiles table
  SELECT plan_name INTO user_plan
  FROM public.user_profiles
  WHERE user_id = current_user_id;

  IF LOWER(TRIM(user_plan)) = 'admin' THEN
    RETURN true;
  END IF;

  -- Not an admin
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.is_admin_user() IS 'Check if current user has admin privileges based on metadata or plan';

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY feedback_insert_self ON public.feedback
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Policy: Users can view their own feedback
CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admins can view all feedback
CREATE POLICY feedback_admin_select ON public.feedback
  FOR SELECT
  USING (public.is_admin_user());

-- Policy: Admins can update all feedback
CREATE POLICY feedback_admin_update ON public.feedback
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy: Admins can delete feedback (cleanup spam)
CREATE POLICY feedback_admin_delete ON public.feedback
  FOR DELETE
  USING (public.is_admin_user());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Add helpful comment
COMMENT ON TABLE public.feedback IS 'User feedback submissions for bugs, ideas, questions, and ratings';
