-- Create favorite_partners table
CREATE TABLE public.favorite_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, favorite_user_id),
  CHECK (user_id != favorite_user_id)
);

-- Enable RLS
ALTER TABLE public.favorite_partners ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
ON public.favorite_partners
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
ON public.favorite_partners
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
ON public.favorite_partners
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_favorite_partners_user_id ON public.favorite_partners(user_id);
CREATE INDEX idx_favorite_partners_favorite_user_id ON public.favorite_partners(favorite_user_id);