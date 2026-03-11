const SINGAPORE_TIMEZONE = 'Asia/Singapore';

function formatToParts(date: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

export function getSingaporeNow(): Date {
  const parts = formatToParts(new Date());
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
  return new Date(iso);
}

export function toSingaporeDate(input: string | Date): Date {
  const source = typeof input === 'string' ? new Date(input) : input;
  const parts = formatToParts(source);
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
  return new Date(iso);
}

export function formatSingaporeDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}