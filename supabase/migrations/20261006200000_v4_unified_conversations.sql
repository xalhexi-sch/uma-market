-- =============================================================================
-- UMA Market V4 — Unified Relationship Messaging Migration
-- Migration: 20261006200000_v4_unified_conversations.sql
--
-- 1. Create conversations table:
--    - Business A <-> Business B relationship container
--    - Canonical uniqueness constraint: CHECK (business_a_id < business_b_id)
--    - UNIQUE (business_a_id, business_b_id) strictly prevents duplicate conversations
-- 2. Alter messages table:
--    - Drop NOT NULL on order_id (messages can now be pre-purchase or context-free)
--    - Add conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE
--    - Add sender_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL
--    - Add product_id UUID REFERENCES products(id) ON DELETE SET NULL (optional context)
-- 3. Row Level Security:
--    - Conversations: Only active members of participating businesses (A or B) can view/insert
--    - Messages: Only participants in conversation can view/insert
--    - Recursion-safe: Uses direct user_id match on business_members
-- 4. Publication:
--    - Add conversations to supabase_realtime
-- 5. Trigger:
--    - Update conversations.last_message_at on message insert
--    - Update trigger_message_notification to support V4 conversation recipients
-- 6. Idempotent legacy message backfill:
--    - Resolves buyer business from COALESCE(orders.business_id, buyer_biz.id)
--    - Resolves seller business from businesses.legacy_clerk_id = orders.farmer_clerk_id
--    - Creates canonical conversations and updates messages.conversation_id
-- =============================================================================

-- ── 1. Create conversations table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_a_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_b_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_conversation_canonical_order CHECK (business_a_id < business_b_id),
  CONSTRAINT uq_conversations_business_pair UNIQUE (business_a_id, business_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_business_a
  ON public.conversations (business_a_id);

CREATE INDEX IF NOT EXISTS idx_conversations_business_b
  ON public.conversations (business_b_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON public.conversations (last_message_at DESC);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 2. Alter messages table ───────────────────────────────────────────────────

ALTER TABLE public.messages
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_product_id
  ON public.messages (product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sender_business_id
  ON public.messages (sender_business_id);

-- ── 3. Row Level Security on conversations ────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations: members can view their conversations" ON public.conversations;
CREATE POLICY "conversations: members can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.user_id = (auth.jwt()->>'sub')
        AND (bm.business_id = conversations.business_a_id OR bm.business_id = conversations.business_b_id)
    )
  );

DROP POLICY IF EXISTS "conversations: members can create conversations for their business" ON public.conversations;
CREATE POLICY "conversations: members can create conversations for their business"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.user_id = (auth.jwt()->>'sub')
        AND (bm.business_id = conversations.business_a_id OR bm.business_id = conversations.business_b_id)
    )
  );

-- ── 3b. Counterparty business visibility for conversations ───────────────────

DROP POLICY IF EXISTS "businesses: counterparties can view conversation partner" ON public.businesses;
CREATE POLICY "businesses: counterparties can view conversation partner"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.business_members bm
        ON (bm.business_id = c.business_a_id OR bm.business_id = c.business_b_id)
      WHERE (c.business_a_id = businesses.id OR c.business_b_id = businesses.id)
        AND bm.user_id = (auth.jwt()->>'sub')
    )
  );

-- ── 4. Update Row Level Security on messages ──────────────────────────────────

DROP POLICY IF EXISTS "messages: participants read" ON public.messages;
DROP POLICY IF EXISTS "messages: participants insert" ON public.messages;

-- Both conversation participants and legacy order participants can read
CREATE POLICY "messages: participants read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    (
      conversation_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.business_members bm ON (bm.business_id = c.business_a_id OR bm.business_id = c.business_b_id)
        WHERE c.id = messages.conversation_id
          AND bm.user_id = (auth.jwt()->>'sub')
      )
    )
    OR
    (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = messages.order_id
          AND (
            o.business_clerk_id = (auth.jwt()->>'sub')
            OR o.farmer_clerk_id = (auth.jwt()->>'sub')
            OR (o.business_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.business_members bm
              WHERE bm.business_id = o.business_id
                AND bm.user_id = (auth.jwt()->>'sub')
            ))
          )
      )
    )
  );

-- Insert policy with active business membership check
CREATE POLICY "messages: participants insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt()->>'sub' = sender_clerk_id
    AND (
      (
        conversation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          JOIN public.business_members bm ON (bm.business_id = c.business_a_id OR bm.business_id = c.business_b_id)
          WHERE c.id = messages.conversation_id
            AND bm.user_id = (auth.jwt()->>'sub')
            AND (messages.sender_business_id IS NULL OR messages.sender_business_id = bm.business_id)
        )
      )
      OR
      (
        order_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = messages.order_id
            AND (
              o.business_clerk_id = (auth.jwt()->>'sub')
              OR o.farmer_clerk_id = (auth.jwt()->>'sub')
            )
        )
      )
    )
  );

-- ── 5. Realtime publication ───────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END;
$$;

-- ── 6. Trigger: update last_message_at on conversations ───────────────────────

CREATE OR REPLACE FUNCTION public.trigger_message_update_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET
      last_message_at = NEW.created_at,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_update_conversation ON public.messages;
CREATE TRIGGER trg_messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_update_conversation();

-- ── 7. Notification Trigger: Support V4 Conversations ─────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient TEXT;
  v_role TEXT;
  v_recipient_business_id UUID;
  v_member RECORD;
BEGIN
  -- 1. Legacy order notification path if order_id is present
  IF NEW.order_id IS NOT NULL THEN
    SELECT CASE WHEN o.business_clerk_id = NEW.sender_clerk_id THEN o.farmer_clerk_id ELSE o.business_clerk_id END,
           CASE WHEN o.business_clerk_id = NEW.sender_clerk_id THEN 'farmer' ELSE 'business' END
      INTO v_recipient, v_role FROM public.orders o WHERE o.id = NEW.order_id;
    IF v_recipient IS NOT NULL THEN
      PERFORM public.create_notification(
        v_recipient,
        'new_message',
        'You received a new order message',
        'You have a new message about an order.',
        'message',
        NEW.id,
        CASE WHEN v_role = 'farmer' THEN '/farmer/messages' ELSE '/business/messages' END,
        'message:' || NEW.id
      );
    END IF;
  ELSIF NEW.conversation_id IS NOT NULL THEN
    -- 2. V4 conversation notification path
    SELECT CASE
      WHEN c.business_a_id = NEW.sender_business_id THEN c.business_b_id
      WHEN c.business_b_id = NEW.sender_business_id THEN c.business_a_id
      WHEN EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = c.business_a_id AND bm.user_id = NEW.sender_clerk_id) THEN c.business_b_id
      ELSE c.business_a_id
    END INTO v_recipient_business_id
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

    IF v_recipient_business_id IS NOT NULL THEN
      FOR v_member IN
        SELECT bm.user_id FROM public.business_members bm
        WHERE bm.business_id = v_recipient_business_id
          AND bm.role = 'OWNER'
      LOOP
        PERFORM public.create_notification(
          v_member.user_id,
          'new_message',
          'New message received',
          SUBSTRING(NEW.body FROM 1 FOR 80),
          'message',
          NEW.id,
          '/messages/' || NEW.conversation_id,
          'message:' || NEW.id || ':' || v_member.user_id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 8. Idempotent Backfill from Legacy Order Messages ─────────────────────────

-- Create canonical relationship conversations for existing order messages
WITH order_pairs AS (
  SELECT DISTINCT
    LEAST(
      COALESCE(o.business_id, bb.id),
      sb.id
    ) AS b_a,
    GREATEST(
      COALESCE(o.business_id, bb.id),
      sb.id
    ) AS b_b,
    MAX(m.created_at) AS last_msg
  FROM public.messages m
  JOIN public.orders o ON o.id = m.order_id
  LEFT JOIN public.businesses bb ON bb.legacy_clerk_id = o.business_clerk_id
  LEFT JOIN public.businesses sb ON sb.legacy_clerk_id = o.farmer_clerk_id
  WHERE COALESCE(o.business_id, bb.id) IS NOT NULL
    AND sb.id IS NOT NULL
    AND COALESCE(o.business_id, bb.id) <> sb.id
  GROUP BY 1, 2
)
INSERT INTO public.conversations (business_a_id, business_b_id, last_message_at)
SELECT b_a, b_b, COALESCE(last_msg, NOW())
FROM order_pairs
ON CONFLICT (business_a_id, business_b_id) DO NOTHING;

-- Backfill conversation_id and sender_business_id on legacy messages
UPDATE public.messages m
SET
  conversation_id = c.id,
  sender_business_id = CASE
    WHEN m.sender_clerk_id = o.business_clerk_id THEN COALESCE(o.business_id, bb.id)
    WHEN m.sender_clerk_id = o.farmer_clerk_id THEN sb.id
    ELSE COALESCE(o.business_id, bb.id)
  END
FROM public.orders o
LEFT JOIN public.businesses bb ON bb.legacy_clerk_id = o.business_clerk_id
LEFT JOIN public.businesses sb ON sb.legacy_clerk_id = o.farmer_clerk_id
JOIN public.conversations c ON (
  c.business_a_id = LEAST(COALESCE(o.business_id, bb.id), sb.id)
  AND c.business_b_id = GREATEST(COALESCE(o.business_id, bb.id), sb.id)
)
WHERE m.order_id = o.id
  AND m.conversation_id IS NULL;
