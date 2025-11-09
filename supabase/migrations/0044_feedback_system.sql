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
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Policy: Admins can update all feedback
CREATE POLICY feedback_admin_update ON public.feedback
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Policy: Admins can delete feedback (cleanup spam)
CREATE POLICY feedback_admin_delete ON public.feedback
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

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
