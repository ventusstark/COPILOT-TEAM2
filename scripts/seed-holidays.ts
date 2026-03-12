import { holidayDB } from '@/lib/db';

const SINGAPORE_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'New Year\'s Day', year: 2026 },
  { date: '2026-02-17', name: 'Chinese New Year', year: 2026 },
  { date: '2026-02-18', name: 'Chinese New Year Holiday', year: 2026 },
  { date: '2026-03-20', name: 'Hari Raya Puasa', year: 2026 },
  { date: '2026-04-03', name: 'Good Friday', year: 2026 },
  { date: '2026-05-01', name: 'Labour Day', year: 2026 },
  { date: '2026-05-31', name: 'Vesak Day', year: 2026 },
  { date: '2026-06-01', name: 'Vesak Day Holiday', year: 2026 },
  { date: '2026-08-10', name: 'National Day Holiday', year: 2026 },
  { date: '2026-11-01', name: 'Deepavali', year: 2026 },
  { date: '2026-11-02', name: 'Deepavali Holiday', year: 2026 },
  { date: '2026-12-25', name: 'Christmas Day', year: 2026 },
];

holidayDB.upsertMany(SINGAPORE_HOLIDAYS_2026);
