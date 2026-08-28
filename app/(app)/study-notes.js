'use client';
import { useState, useEffect, useCallback } from 'react';
import InfoTip from './info-tip.js';
import AskPanel from './ask-panel.js';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fieldStyle = {
  width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13.5,
  fontFamily: 'inherit', resize: 'vertical',
};

const labelStyle = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'inherit' };

function NoteList({ text, variant }) {
  const items = (text || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!items.length) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing here yet.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5 }}>
          {variant === 'focus' ? (
            <span className="mono" style={{ flexShrink: 0, color: 'var(--warning)', fontWeight: 700, fontSize: 12.5, minWidth: 16, marginTop: 1 }}>{i + 1}</span>
          ) : (
            <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 7 }} />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NoteEditor({ note, onSave, onDelete, onBack }) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(note.summary || '');
  const [keyPoints, setKeyPoints] = useState(note.key_points || '');
  const [testFocus, setTestFocus] = useState(note.test_focus || '');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setSummary(note.summary || ''); setKeyPoints(note.key_points || ''); setTestFocus(note.test_focus || '');
    setEditing(true);
  }

  function cancel() {
    setSummary(note.summary || ''); setKeyPoints(note.key_points || ''); setTestFocus(note.test_focus || '');
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    await onSave(note.id, { summary, key_points: keyPoints, test_focus: testFocus });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div>
      <button className="btn secondary" onClick={onBack} style={{ marginBottom: 20 }}>&larr; Back to notes</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{note.source_title}</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {!editing && (
            <button type="button" className="btn secondary" onClick={startEdit} style={{ padding: '8px 16px', fontSize: 13 }}>Edit</button>
          )}
          <button type="button" onClick={() => onDelete(note.id)} aria-label="Delete note" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>&times;</button>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card">
          <span className="mono" style={labelStyle}>Summary</span>
          {editing ? (
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} style={{ ...fieldStyle, marginTop: 10 }} />
          ) : (
            <p style={{ fontSize: 15.5, lineHeight: 1.6, marginTop: 10 }}>
              {summary || <span style={{ color: 'var(--muted)', fontSize: 13 }}>No summary.</span>}
            </p>
          )}
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <span className="mono" style={labelStyle}>Key points</span>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '4px 0 14px' }}>The notes worth writing down.</p>
          {editing ? (
            <textarea value={keyPoints} onChange={e => setKeyPoints(e.target.value)} rows={7} style={fieldStyle} placeholder="One per line" />
          ) : (
            <NoteList text={keyPoints} />
          )}
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <span className="mono" style={labelStyle}>Test focus</span>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '4px 0 14px' }}>Most likely to actually show up on a test.</p>
          {editing ? (
            <textarea value={testFocus} onChange={e => setTestFocus(e.target.value)} rows={6} style={fieldStyle} placeholder="One per line" />
          ) : (
            <NoteList text={testFocus} variant="focus" />
          )}
        </div>

        {!editing && (
          <div>
            <span className="mono" style={{ ...labelStyle, display: 'block', marginBottom: 10 }}>Ask about this</span>
            <AskPanel
              context={[
                `Title: ${note.source_title}`,
                note.summary ? `Summary: ${note.summary}` : '',
                note.key_points ? `Key points:\n${note.key_points}` : '',
                note.test_focus ? `Test focus:\n${note.test_focus}` : '',
              ].filter(Boolean).join('\n\n')}
              placeholder="Stuck on something in these notes? Ask about it here."
            />
          </div>
        )}

        {editing && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn secondary" onClick={cancel} disabled={saving}>Cancel</button>
            <button type="button" className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyNotes() {
  const [notes, setNotes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [activeNoteId, setActiveNoteId] = useState(null);

  const refresh = useCallback(() => {
    fetch('/api/study-notes').then(r => r.json()).then(d => setNotes(d.notes || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/ai/study-notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, title: file.name.replace(/\.pdf$/i, '') }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setMsg(`Created study notes for "${data.title}".`);
      refresh();
    } catch (err) {
      setMsg('Something went wrong reading that file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleVideoSubmit(e) {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setProcessingVideo(true); setMsg('');
    try {
      const res = await fetch('/api/ai/study-notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setMsg(`Created study notes for "${data.title}".`);
      setYoutubeUrl('');
      refresh();
    } catch (err) {
      setMsg('Something went wrong reaching that video.');
    } finally {
      setProcessingVideo(false);
    }
  }

  async function saveNote(id, fields) {
    await fetch(`/api/study-notes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    });
    refresh();
  }

  async function deleteNote(id) {
    if (!window.confirm("Delete this study note? This can't be undone.")) return;
    await fetch(`/api/study-notes/${id}`, { method: 'DELETE' });
    setActiveNoteId(null);
    refresh();
  }

  if (activeNoteId) {
    const note = notes.find(n => n.id === activeNoteId);
    if (!note) {
      return (
        <div>
          <button className="btn secondary" onClick={() => setActiveNoteId(null)} style={{ marginBottom: 20 }}>&larr; Back to notes</button>
          <p style={{ color: 'var(--muted)' }}>That note is gone.</p>
        </div>
      );
    }
    return <NoteEditor note={note} onSave={saveNote} onDelete={deleteNote} onBack={() => setActiveNoteId(null)} />;
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h2 style={{ fontSize: 19, margin: 0 }}>Study notes</h2>
        <InfoTip>
          Upload a PDF or paste a YouTube link and DailyAI reads or watches the whole thing, then writes you a short
          summary, a short list of key points worth writing down, and a separate short list of the specific things
          most likely to come up on a test &mdash; definitions, formulas, dates, named concepts, cause-and-effect.
          It's kept deliberately short &mdash; the highlights, not a transcript. Hit Edit on any note to trim or add
          to it before you rely on it to study from.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 13.5 }}>
        Different from flashcards above &mdash; this builds a study guide you read through, rather than cards you drill.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 24, alignItems: 'start' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>From a document</label>
            <label className="btn wide" style={{ display: 'inline-block', textAlign: 'center' }}>
              {uploading ? (<><span className="spinner" />Summarizing…</>) : 'Upload a PDF'}
              <input type="file" accept="application/pdf" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>From a video</label>
            <form onSubmit={handleVideoSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="url"
                placeholder="Paste a public YouTube link"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                disabled={processingVideo}
                style={{ flex: 1, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', padding: '10px 12px', fontSize: 13.5 }}
              />
              <button className="btn secondary" type="submit" disabled={processingVideo}>
                {processingVideo ? (<><span className="spinner" />Summarizing…</>) : 'Generate'}
              </button>
            </form>
          </div>
        </div>
        {msg && <p style={{ marginTop: 16, fontSize: 13, color: msg.startsWith('Created') ? 'var(--good)' : 'var(--critical)' }}>{msg}</p>}
        {uploading && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Reading through the document and pulling out what matters — usually quick, a minute at most.
          </p>
        )}
        {processingVideo && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Watching the video and pulling out what matters — this can take a few minutes for longer videos.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 18 }}>
        {notes.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 28px', border: '1px dashed var(--border-strong)', boxShadow: 'none', gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: 8 }}>No notes yet</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto' }}>
              Upload a PDF or paste a YouTube link above and DailyFlow will turn it into a study guide you can read
              through before a test.
            </p>
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} className="card" style={{ border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <h3 style={{ fontSize: 15 }}>{n.source_title}</h3>
              <button
                onClick={() => deleteNote(n.id)}
                aria-label="Delete note"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, padding: '0 2px', flexShrink: 0 }}
              >
                &times;
              </button>
            </div>
            <p style={{
              color: 'var(--text-2)', fontSize: 12.5, marginBottom: 14, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            }}>
              {n.summary}
            </p>
            <button className="btn secondary wide" onClick={() => setActiveNoteId(n.id)}>View notes</button>
          </div>
        ))}
      </div>
    </div>
  );
}
