-- =============================================================
-- UMA Market — V4 Notification URL Convergence (F4)
-- Migration: 20261008000000_v4_notification_urls
--
-- Forward-fix only. Notification triggers now generate CANONICAL V4
-- destinations for every NEW row:
--
--   seller-recipient notifications  ->  /dashboard/orders
--   buyer-recipient notifications   ->  /orders/<order id>
--   order message notifications     ->  /messages
--   review notifications (seller)   ->  /dashboard/orders
--   V4 conversation messages        ->  /messages/<conversation id> (unchanged)
--
-- Why the seller destination is NOT /orders/<id>:
--   /orders/[id] is the BUYER order detail page. A legacy seller
--   notification URL (/farmer/orders/<id>) must never open buyer order
--   detail, and there is no seller order detail route in V4 — the
--   canonical seller destination is the /dashboard/orders workspace.
--   The order id remains preserved in notifications.entity_id.
--
-- Historical rows are intentionally NOT rewritten: existing
-- /farmer/* and /business/* action_url values stay valid through the
-- redirect bridge in next.config.ts, which maps:
--
--   /farmer/orders/<id>   ->  /dashboard/orders   (never buyer detail)
--   /business/orders/<id> ->  /orders/<id>
--   /farmer/messages      ->  /messages
--   /business/messages    ->  /messages
--
-- No tables, policies, grants, triggers, dedupe keys, recipients or
-- copy change here; only the action_url literals inside the three
-- trigger functions. create_notification(), the read-only UPDATE lock
-- and RLS stay exactly as designed in 20261002000005.
-- =============================================================

-- Order lifecycle notifications (latest definition: 20261002000006)
CREATE OR REPLACE FUNCTION public.trigger_order_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->>'user_role';
  v_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_recipient TEXT;
  v_url TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(NEW.farmer_clerk_id, 'new_order', 'New order received', 'A new order is waiting for you.', 'order', NEW.id, '/dashboard/orders', 'order:new:' || NEW.id);
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  -- An IF chain is used deliberately: a procedural CASE without ELSE raises
  -- 'case not found' for statuses UMA does not notify on (e.g. 'preparing'),
  -- which must never abort the farmer's status transition.
  IF NEW.status = 'accepted' THEN
    v_type := 'order_accepted'; v_title := 'Your order was accepted'; v_body := 'Your order has been accepted by the farmer.';
  ELSIF NEW.status = 'ready' THEN
    v_type := 'order_ready'; v_title := 'Your order is ready'; v_body := 'Your order is ready for the next step.';
  ELSIF NEW.status = 'for_delivery' THEN
    v_type := 'order_for_delivery'; v_title := 'Your order is out for delivery'; v_body := 'Your order is on its way.';
  ELSIF NEW.status = 'completed' THEN
    v_type := 'order_completed'; v_title := 'Your order was completed'; v_body := 'Your order has been completed.';
  ELSIF NEW.status = 'cancelled' THEN
    IF v_role = 'farmer' THEN
      v_type := 'farmer_cancellation'; v_title := 'Your order was cancelled'; v_body := 'A farmer cancelled your order.';
    ELSIF v_role = 'business' THEN
      v_type := 'business_cancellation'; v_title := 'An order was cancelled'; v_body := 'A buyer cancelled the order.';
    END IF;
  END IF;

  IF v_type IS NULL THEN RETURN NEW; END IF;
  IF v_type = 'business_cancellation' OR v_type = 'new_order' THEN
    -- Seller recipient: canonical seller workspace (never buyer order detail).
    v_recipient := NEW.farmer_clerk_id; v_url := '/dashboard/orders';
  ELSE
    -- Buyer recipient: canonical buyer order detail keeps the order id.
    v_recipient := NEW.business_clerk_id; v_url := '/orders/' || NEW.id;
  END IF;
  PERFORM public.create_notification(v_recipient, v_type, v_title, v_body, 'order', NEW.id, v_url, 'order:' || NEW.id || ':' || v_type);
  RETURN NEW;
END;
$$;

-- Message notifications (latest definition: 20261006200000_v4_unified_conversations)
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient TEXT;
  v_recipient_business_id UUID;
  v_member RECORD;
BEGIN
  -- 1. Legacy order notification path if order_id is present
  IF NEW.order_id IS NOT NULL THEN
    SELECT CASE WHEN o.business_clerk_id = NEW.sender_clerk_id THEN o.farmer_clerk_id ELSE o.business_clerk_id END
      INTO v_recipient FROM public.orders o WHERE o.id = NEW.order_id;
    IF v_recipient IS NOT NULL THEN
      PERFORM public.create_notification(
        v_recipient,
        'new_message',
        'You received a new order message',
        'You have a new message about an order.',
        'message',
        NEW.id,
        '/messages',
        'message:' || NEW.id
      );
    END IF;
  ELSIF NEW.conversation_id IS NOT NULL THEN
    -- 2. V4 conversation notification path (already canonical)
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

-- Review notifications (latest definition: 20261002000006)
CREATE OR REPLACE FUNCTION public.trigger_review_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_farmer TEXT; v_entity TEXT;
BEGIN
  SELECT farmer_clerk_id INTO v_farmer FROM public.orders WHERE id = NEW.order_id;
  v_entity := CASE WHEN TG_TABLE_NAME = 'seller_reviews' THEN 'review' ELSE 'product' END;
  PERFORM public.create_notification(v_farmer, 'new_review', 'You received a new buyer review', 'A buyer left a new review for your order.', v_entity,
    -- seller_reviews and product_reviews share this trigger but carry different
    -- columns, so the product id is read from the row's JSON rather than NEW.product_id.
    CASE WHEN v_entity = 'product' THEN (to_jsonb(NEW) ->> 'product_id')::UUID ELSE NEW.id END,
    '/dashboard/orders', 'review:' || NEW.id);
  RETURN NEW;
END;
$$;
