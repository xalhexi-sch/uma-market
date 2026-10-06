"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/supabase/queries/notifications";
import { routes } from "@/platform/routes";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  await markNotificationRead(notificationId);
  revalidatePath(routes.dashboard.notifications);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsRead();
  revalidatePath(routes.dashboard.notifications);
}
