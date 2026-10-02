-- =============================================================
-- UMA Market — Notifications V1
-- Database rows are authoritative; triggers create rows in the source transaction.
-- =============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_clerk_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_order', 'order_accepted', 'order_ready', 'order_for_delivery',
    'order_completed', 'farmer_cancellation', 'business_cancellation',
    'new_message', 'new_review'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order', 'message', 'review', 'product')),
  entity_id UUID,
  action_url TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created
  ON public.notifications (recipient_clerk_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications (recipient_clerk_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: read own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_clerk_id = auth.jwt()->>'sub');

CREATE POLICY "notifications: mark own read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_clerk_id = auth.jwt()->>'sub')
  WITH CHECK (recipient_clerk_id = auth.jwt()->>'sub');

REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.trigger_lock_notification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.recipient_clerk_id IS DISTINCT FROM OLD.recipient_clerk_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.action_url IS DISTINCT FROM OLD.action_url
     OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only notification read state can be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notifications_read_only
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_lock_notification_fields();

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient TEXT,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action_url TEXT,
  p_dedupe_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient IS NULL OR p_recipient = '' THEN RETURN; END IF;
  INSERT INTO public.notifications
    (recipient_clerk_id, type, title, body, entity_type, entity_id, action_url, dedupe_key)
  VALUES
    (p_recipient, p_type, p_title, p_body, p_entity_type, p_entity_id, p_action_url, p_dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, authenticated, anon;

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
    PERFORM public.create_notification(NEW.farmer_clerk_id, 'new_order', 'New order received', 'A new order is waiting for you.', 'order', NEW.id, '/farmer/orders/' || NEW.id, 'order:new:' || NEW.id);
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
    v_recipient := NEW.farmer_clerk_id; v_url := '/farmer/orders/' || NEW.id;
  ELSE
    v_recipient := NEW.business_clerk_id; v_url := '/business/orders/' || NEW.id;
  END IF;
  PERFORM public.create_notification(v_recipient, v_type, v_title, v_body, 'order', NEW.id, v_url, 'order:' || NEW.id || ':' || v_type);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_notifications_insert
  AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trigger_order_notification();
CREATE TRIGGER trg_orders_notifications_status
  AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trigger_order_notification();

CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_recipient TEXT; v_role TEXT;
BEGIN
  SELECT CASE WHEN o.business_clerk_id = NEW.sender_clerk_id THEN o.farmer_clerk_id ELSE o.business_clerk_id END,
         CASE WHEN o.business_clerk_id = NEW.sender_clerk_id THEN 'farmer' ELSE 'business' END
    INTO v_recipient, v_role FROM public.orders o WHERE o.id = NEW.order_id;
  IF v_recipient IS NOT NULL THEN
    PERFORM public.create_notification(v_recipient, 'new_message', 'You received a new order message', 'You have a new message about an order.', 'message', NEW.id,
      CASE WHEN v_role = 'farmer' THEN '/farmer/messages' ELSE '/business/messages' END, 'message:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_notification
  AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trigger_message_notification();

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
    '/farmer/orders/' || NEW.order_id, 'review:' || NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seller_reviews_notification
  AFTER INSERT ON public.seller_reviews FOR EACH ROW EXECUTE FUNCTION public.trigger_review_notification();
CREATE TRIGGER trg_product_reviews_notification
  AFTER INSERT ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.trigger_review_notification();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
