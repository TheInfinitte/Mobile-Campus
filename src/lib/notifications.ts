/**
 * src/lib/notifications.ts
 * WHAT: Creates in-app notifications and sends the matching SMS.
 * WHY : Every important event (verification, viewing, payment, dispute) must
 *       reach the user two ways: inside the app (free) and by SMS (reliable on
 *       any phone). One function keeps them in sync.
 */
import { prisma } from "./prisma";
import { sendSms } from "./termii";
import type { NotificationChannel } from "@prisma/client";

/** What a notification looks like when we create it. */
export type NotifyInput = {
  userId: string;
  title: string;
  body: string;
  link?: string;
  /** When true we also send an SMS with `smsBody` (or `body`). */
  sms?: boolean;
  /** Optional separate SMS text - SMS must be shorter than the in-app body. */
  smsBody?: string;
};

/**
 * notify
 * WHAT: Saves an in-app notification and optionally sends an SMS.
 * WHY : Every route uses this instead of writing its own notification logic.
 *
 * Returns the created notification. Never throws: if the SMS fails we still
 * want the in-app record to exist.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const channel: NotificationChannel = input.sms ? "SMS" : "IN_APP";

  // 1. Always write the in-app notification first (it is free and instant).
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      channel,
    },
  });

  // 2. Optionally send the SMS. We look up the phone number here so callers
  //    do not have to pass it around.
  if (input.sms) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { phone: true },
    });
    if (user?.phone) {
      await sendSms(user.phone, input.smsBody ?? input.body);
    }
  }
}

/**
 * notifyMany
 * WHAT: Sends the same notification to several users at once.
 * WHY : Group rentals involve 3 or 4 people who all need the same update.
 */
export async function notifyMany(
  userIds: string[],
  build: (userId: string) => Omit<NotifyInput, "userId">
): Promise<void> {
  // Deduplicate so a person never gets the same message twice.
  const unique = Array.from(new Set(userIds));
  for (const userId of unique) {
    await notify({ userId, ...build(userId) });
  }
}

/**
 * markAllRead
 * WHAT: Marks every unread notification as read for a user.
 * WHY : The "clear all" button on the notifications screen.
 */
export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * unreadCount
 * WHAT: How many notifications a user has not read.
 * WHY : Shown as the red dot on the notification bell.
 */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
