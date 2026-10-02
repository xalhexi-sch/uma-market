-- =============================================================
-- UMA Market — Notifications V1 trigger corrections (forward fix)
-- Migration: 20261002000006_notifications_v1_trigger_fixes
--
-- Corrects two defects in 20261002000005 that were found by runtime
-- verification against the security-test project:
--
-- 1. trigger_order_notification() used a procedural CASE with no ELSE.
--    Any transition to a status UMA does not notify on (for example
--    'preparing') raised 'case not found' and aborted the farmer's
--    order status update. Replaced with an IF/ELSIF chain.
--
-- 2. trigger_review_notification() referenced NEW.product_id, which does
--    not exist on seller_reviews rows, so seller review inserts failed
--    with: record "new" has no field "product_id". The product id is now
--    read from the row's JSON representation.
--
-- Notification dedupe keys, recipients and copy are unchanged.
-- =============================================================

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