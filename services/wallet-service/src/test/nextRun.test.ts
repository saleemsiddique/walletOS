import { computeFirstMatch, computeNextAfter } from '../lib/nextRun';

const utc = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('computeFirstMatch', () => {
  describe('DAILY', () => {
    it('returns the same day as starts_at', () => {
      const result = computeFirstMatch(utc('2026-05-10'), {
        frequency: 'DAILY',
        day_of_month: null,
        day_of_week: null,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-10');
    });
  });

  describe('WEEKLY', () => {
    it('returns starts_at when it already matches day_of_week', () => {
      // 2026-05-11 was a Monday → day_of_week=0
      const result = computeFirstMatch(utc('2026-05-11'), {
        frequency: 'WEEKLY',
        day_of_month: null,
        day_of_week: 0,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-11');
    });

    it('returns next matching day after starts_at', () => {
      // 2026-05-11 = Monday. Target Sunday (day_of_week=6) → 2026-05-17
      const result = computeFirstMatch(utc('2026-05-11'), {
        frequency: 'WEEKLY',
        day_of_month: null,
        day_of_week: 6,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-17');
    });
  });

  describe('MONTHLY', () => {
    it('returns same month when day_of_month is in the future', () => {
      const result = computeFirstMatch(utc('2026-05-10'), {
        frequency: 'MONTHLY',
        day_of_month: 15,
        day_of_week: null,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-15');
    });

    it('returns same day when starts_at === day_of_month', () => {
      const result = computeFirstMatch(utc('2026-05-15'), {
        frequency: 'MONTHLY',
        day_of_month: 15,
        day_of_week: null,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-15');
    });

    it('rolls to next month when day_of_month already passed', () => {
      const result = computeFirstMatch(utc('2026-05-20'), {
        frequency: 'MONTHLY',
        day_of_month: 15,
        day_of_week: null,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2026-06-15');
    });

    it('clamps day_of_month=31 to last day of month in February', () => {
      const result = computeFirstMatch(utc('2027-02-01'), {
        frequency: 'MONTHLY',
        day_of_month: 31,
        day_of_week: null,
      });
      expect(result.toISOString().slice(0, 10)).toBe('2027-02-28');
    });
  });
});

describe('computeNextAfter', () => {
  it('DAILY advances by 1 day', () => {
    const result = computeNextAfter(utc('2026-05-10'), {
      frequency: 'DAILY',
      day_of_month: null,
      day_of_week: null,
    });
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-11');
  });

  it('WEEKLY advances 7 days when prev already matches', () => {
    const result = computeNextAfter(utc('2026-05-11'), {
      frequency: 'WEEKLY',
      day_of_month: null,
      day_of_week: 0,
    });
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('MONTHLY advances to next month same day', () => {
    const result = computeNextAfter(utc('2026-05-15'), {
      frequency: 'MONTHLY',
      day_of_month: 15,
      day_of_week: null,
    });
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('MONTHLY day_of_month=31 clamps in shorter month and recovers next', () => {
    const after = computeNextAfter(utc('2026-01-31'), {
      frequency: 'MONTHLY',
      day_of_month: 31,
      day_of_week: null,
    });
    expect(after.toISOString().slice(0, 10)).toBe('2026-02-28');

    const after2 = computeNextAfter(after, {
      frequency: 'MONTHLY',
      day_of_month: 31,
      day_of_week: null,
    });
    expect(after2.toISOString().slice(0, 10)).toBe('2026-03-31');
  });
});
