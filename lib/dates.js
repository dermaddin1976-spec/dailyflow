// Shared date helpers for the "last N days" chart axes (Sleep, Sport, Study,
// Trends, Today) — split out from bar-chart.js so pages that only need the
// date math (server components) don't have to import a client component file.
export function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function weekdayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}
