'use client';
import AskPanel from './ask-panel.js';

export default function TodayCoach({ context }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ marginBottom: 4 }}>Ask your coach</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 13 }}>
        DailyAI sees your sleep, training, nutrition and study together &mdash; ask about your training plan, how your week&apos;s going, or what to focus on.
      </p>
      <AskPanel
        context={context}
        placeholder="e.g. What should today's training focus be? How's my week looking overall?"
        domain="coach"
      />
    </div>
  );
}
