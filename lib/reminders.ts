import { z } from 'zod';
import { getSingaporeNow, toSingaporeDate } from '@/lib/timezone';

export const REMINDER_OPTIONS = [15, 30, 60, 120, 1440, 2880, 10080] as const;

export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number];

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
};

export const reminderMinutesSchema = z
  .number()
  .int()
  .refine((value): value is ReminderMinutes => REMINDER_OPTIONS.includes(value as ReminderMinutes), {
    message: 'Invalid reminder value',
  });

export function isReminderMinutes(value: number | null | undefined): value is ReminderMinutes {
  return value !== null && value !== undefined && REMINDER_OPTIONS.includes(value as ReminderMinutes);
}

export function getReminderLabel(value: number | null | undefined): string | null {
  if (!isReminderMinutes(value)) {
    return null;
  }

  return REMINDER_LABELS[value];
}

export function getReminderTriggerAt(dueDate: string, reminderMinutes: ReminderMinutes): Date {
  const dueAt = toSingaporeDate(dueDate);
  return new Date(dueAt.getTime() - reminderMinutes * 60_000);
}

export function shouldSendReminder(input: {
  dueDate: string | null;
  reminderMinutes: number | null;
  lastNotificationSent: string | null;
  now?: Date;
}): boolean {
  if (!input.dueDate || !isReminderMinutes(input.reminderMinutes) || input.lastNotificationSent) {
    return false;
  }

  const now = input.now ?? getSingaporeNow();
  return now.getTime() >= getReminderTriggerAt(input.dueDate, input.reminderMinutes).getTime();
}