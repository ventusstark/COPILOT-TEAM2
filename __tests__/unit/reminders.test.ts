import { describe, expect, test } from 'vitest';
import {
  REMINDER_LABELS,
  REMINDER_OPTIONS,
  getReminderLabel,
  getReminderTriggerAt,
  isReminderMinutes,
  reminderMinutesSchema,
  shouldSendReminder,
} from '@/lib/reminders';

describe('reminder utilities', () => {
  test('reminder options and labels are aligned', () => {
    expect(REMINDER_OPTIONS.length).toBe(7);
    for (const option of REMINDER_OPTIONS) {
      expect(REMINDER_LABELS[option]).toBeDefined();
    }
  });

  test('isReminderMinutes validates supported values', () => {
    expect(isReminderMinutes(15)).toBe(true);
    expect(isReminderMinutes(30)).toBe(true);
    expect(isReminderMinutes(999)).toBe(false);
    expect(isReminderMinutes(null)).toBe(false);
    expect(isReminderMinutes(undefined)).toBe(false);
  });

  test('getReminderLabel returns null for unsupported value', () => {
    expect(getReminderLabel(60)).toBe('1h');
    expect(getReminderLabel(999)).toBeNull();
    expect(getReminderLabel(null)).toBeNull();
  });

  test('getReminderTriggerAt subtracts minutes from due date', () => {
    const trigger = getReminderTriggerAt('2026-03-15T10:00:00+08:00', 60);
    expect(trigger.toISOString()).toBe('2026-03-15T01:00:00.000Z');
  });

  test('shouldSendReminder returns false for missing requirements', () => {
    expect(shouldSendReminder({ dueDate: null, reminderMinutes: 60, lastNotificationSent: null })).toBe(false);
    expect(shouldSendReminder({ dueDate: '2026-03-15T10:00:00+08:00', reminderMinutes: null, lastNotificationSent: null })).toBe(false);
    expect(shouldSendReminder({ dueDate: '2026-03-15T10:00:00+08:00', reminderMinutes: 60, lastNotificationSent: '2026-03-15T01:00:00+08:00' })).toBe(false);
  });

  test('shouldSendReminder returns true only when now is at or after trigger', () => {
    const dueDate = '2026-03-15T10:00:00+08:00';
    const beforeTrigger = new Date('2026-03-15T00:59:59.000Z');
    const atTrigger = new Date('2026-03-15T01:00:00.000Z');

    expect(shouldSendReminder({ dueDate, reminderMinutes: 60, lastNotificationSent: null, now: beforeTrigger })).toBe(false);
    expect(shouldSendReminder({ dueDate, reminderMinutes: 60, lastNotificationSent: null, now: atTrigger })).toBe(true);
  });

  test('reminderMinutesSchema accepts valid values and rejects invalid values', () => {
    expect(reminderMinutesSchema.safeParse(120).success).toBe(true);
    expect(reminderMinutesSchema.safeParse(121).success).toBe(false);
  });
});
