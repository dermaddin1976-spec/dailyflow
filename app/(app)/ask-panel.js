'use client';
import { useState, useRef, useEffect } from 'react';

export default function AskPanel({ context, placeholder }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  async function send(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    const priorMessages = messages;
    const nextMessages = [...priorMessages, { role: 'user', text: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, question, history: priorMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setMessages(priorMessages);
        return;
      }
      setMessages([...nextMessages, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setError('Something went wrong reaching DailyAI.');
      setMessages(priorMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 && !loading && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {placeholder || 'Ask a question about this — DailyAI will answer using the material above.'}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--btn-gradient)' : 'var(--surface-2)',
                color: m.role === 'user' ? 'var(--accent-ink)' : 'var(--text)',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 13px',
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}><span className="spinner" />Thinking…</p>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="error-text" style={{ marginBottom: 8 }}>{error}</p>}
      <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question about this…"
          disabled={loading}
          style={{
            flex: 1, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)', color: 'var(--text)', padding: '10px 12px', fontSize: 13.5,
          }}
        />
        <button className="btn secondary" type="submit" disabled={loading || !input.trim()}>Ask</button>
      </form>
    </div>
  );
}
