'use client';

import { useEffect, useState } from 'react';
import { getReminderLabel } from '@/lib/reminders';
import { formatSingaporeDate } from '@/lib/timezone';

interface ReminderTodo {
  id: number;
  title: string;
  due_date: string | null;
  reminder_minutes: number | null;
}

interface NotificationApiResponse {
  success: boolean;
  data?: ReminderTodo[];
}

type NotificationState = NotificationPermission | 'unsupported';

function getInitialPermission(): NotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationState>(getInitialPermission);

  useEffect(() => {
    setPermission(getInitialPermission());
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    let active = true;

    const checkNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/check');
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as NotificationApiResponse;
        if (!active || !payload.data) {
          return;
        }

        payload.data.forEach((todo) => {
          const reminderLabel = getReminderLabel(todo.reminder_minutes);
          const bodyParts = [reminderLabel ? `Reminder ${reminderLabel} before` : null, todo.due_date ? `Due ${formatSingaporeDate(todo.due_date)}` : null]
            .filter((value): value is string => Boolean(value));

          new Notification(todo.title, {
            body: bodyParts.join(' | ') || 'Todo reminder',
          });
        });
      } catch {
        return;
      }
    };

    void checkNotifications();
    const intervalId = window.setInterval(() => {
      void checkNotifications();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [permission]);

  async function requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    return nextPermission;
  }

  return {
    enabled: permission === 'granted',
    permission,
    requestPermission,
    supported: permission !== 'unsupported',
  };
}