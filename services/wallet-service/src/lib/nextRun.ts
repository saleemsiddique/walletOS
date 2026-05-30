// Convención del proyecto: day_of_week = 0 (lunes) ... 6 (domingo).
// JS Date.getUTCDay() devuelve 0 (domingo) ... 6 (sábado).
function toJsDay(projectDay: number): number {
  return (projectDay + 1) % 7;
}

function dateUTC(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day));
}

// Devuelve el último día válido del mes acotado por `day` (ej. day=31 en febrero → 28/29).
function clampToMonth(year: number, month0: number, day: number): Date {
  const lastDayOfMonth = dateUTC(year, month0 + 1, 0).getUTCDate();
  return dateUTC(year, month0, Math.min(day, lastDayOfMonth));
}

function startOfDayUTC(date: Date): Date {
  return dateUTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type RecurrenceParams = {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  day_of_month: number | null;
  day_of_week: number | null;
};

// Primer día (≥ from) que cumple el patrón. Usado al crear la regla.
export function computeFirstMatch(from: Date, params: RecurrenceParams): Date {
  const start = startOfDayUTC(from);

  if (params.frequency === 'DAILY') return start;

  if (params.frequency === 'WEEKLY') {
    if (params.day_of_week === null) {
      throw new Error('day_of_week required for WEEKLY frequency');
    }
    const targetJsDay = toJsDay(params.day_of_week);
    const diff = (targetJsDay - start.getUTCDay() + 7) % 7;
    return addDaysUTC(start, diff);
  }

  // MONTHLY
  if (params.day_of_month === null) {
    throw new Error('day_of_month required for MONTHLY frequency');
  }
  const sameMonth = clampToMonth(start.getUTCFullYear(), start.getUTCMonth(), params.day_of_month);
  if (sameMonth.getTime() >= start.getTime()) return sameMonth;
  return clampToMonth(start.getUTCFullYear(), start.getUTCMonth() + 1, params.day_of_month);
}

// Siguiente día (> prev) que cumple el patrón. Usado por el cron tras materializar.
export function computeNextAfter(prev: Date, params: RecurrenceParams): Date {
  return computeFirstMatch(addDaysUTC(startOfDayUTC(prev), 1), params);
}
