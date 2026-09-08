'use client';
import { useState, useEffect } from 'react';
import AskPanel from './ask-panel.js';

function buildContext(logs) {
  const byDate = {};
  logs.forEach(l => {
    byDate[l.date] = byDate[l.date] || [];
    byDate[l.date].push(l);
  });
  const dates = Object.keys(byDate).sort().reverse().slice(0, 30);
  const lines = ['Recently logged meals, most recent day first:'];
  dates.forEach(date => {
    const dayLogs = byDate[date];
    const totals = dayLogs.reduce((acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0),
      fat: acc.fat + (l.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    lines.push(`\n${date} — day total ${totals.calories} cal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat:`);
    dayLogs.forEach(l => {
      lines.push(`  - ${l.description}: ${l.calories ?? '?'} cal, ${l.protein ?? '?'}g protein, ${l.carbs ?? '?'}g carbs, ${l.fat ?? '?'}g fat`);
    });
  });
  return lines.join('\n');
}

export default function NutritionAsk() {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/logs/meal')
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || logs.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 28 }}>
      <h3 style={{ marginBottom: 4 }}>Ask about your eating</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
        DailyAI answers using your recently logged meals &mdash; ask about patterns, gaps, or what to change.
      </p>
      <AskPanel
        context={buildContext(logs)}
        placeholder="e.g. Why am I always low on protein? What did I eat most on weekends?"
      />
    </div>
  );
}
