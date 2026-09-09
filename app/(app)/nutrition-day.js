'use client';
import { useState, useMemo } from 'react';

function todayStr(){ return new Date().toISOString().slice(0, 10); }
function shiftDate(dateStr, offset) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayChipLabel(dateStr, today) {
  if (dateStr === today) return 'Today';
  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return 'Yest';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayFullLabel(dateStr, today) {
  if (dateStr === today) return 'Today';
  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const miniFieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px',
  fontSize: 12.5, fontFamily: 'inherit', width: '100%',
};

// A single day's meal, as a two-line block (description, then a muted macro
// line) instead of the old cramped single-row format — with the same
// edit/delete affordances the log form used to show in its own separate
// history list, now that this is the only place meals are listed.
function DayMealRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [calories, setCalories] = useState(item.calories ?? '');
  const [protein, setProtein] = useState(item.protein ?? '');
  const [carbs, setCarbs] = useState(item.carbs ?? '');
  const [fat, setFat] = useState(item.fat ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(item.id, { description, calories, protein, carbs, fat });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setDescription(item.description);
    setCalories(item.calories ?? '');
    setProtein(item.protein ?? '');
    setCarbs(item.carbs ?? '');
    setFat(item.fat ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface-2)' }}>
        <input value={description} onChange={e => setDescription(e.target.value)} style={{ ...miniFieldStyle, marginBottom: 6 }} />
        <div className="edit-fields-4">
          <input type="number" min="0" placeholder="cal" value={calories} onChange={e => setCalories(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="0" placeholder="protein" value={protein} onChange={e => setProtein(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="0" placeholder="carbs" value={carbs} onChange={e => setCarbs(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="0" placeholder="fat" value={fat} onChange={e => setFat(e.target.value)} style={miniFieldStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={cancel}>Cancel</button>
          <button type="button" className="btn" style={{ fontSize: 12, padding: '6px 10px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {item.photo_data_url && (
        <>
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="View photo"
            style={{ flexShrink: 0, lineHeight: 0, background: 'none', border: 'none', padding: 0, cursor: 'zoom-in' }}
          >
            <img
              src={item.photo_data_url} alt=""
              style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)', display: 'block' }}
            />
          </button>
          {photoOpen && (
            <div
              onClick={() => setPhotoOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, cursor: 'zoom-out',
              }}
            >
              <img
                src={item.photo_data_url} alt=""
                style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
              />
            </div>
          )}
        </>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
          {[item.calories && `${item.calories} cal`, item.protein && `${item.protein}p`, item.carbs && `${item.carbs}c`, item.fat && `${item.fat}f`].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit meal" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>&#9998;</button>
        <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete meal" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 0 }}>&times;</button>
      </span>
    </div>
  );
}

// A quick day browser for "what did I eat on X" — a row of the last 7 days
// plus a date picker for anything further back, instead of needing to scroll
// past the logging form into a separate history list. This is now the one
// and only place meals are listed on the Nutrition tab (editing and deleting
// included), so nothing is shown twice.
export default function NutritionDayPicker({ items, onSave, onDelete }) {
  const today = todayStr();
  const [selected, setSelected] = useState(today);

  const days = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) list.push(shiftDate(today, -i));
    return list;
  }, [today]);

  const dayItems = useMemo(
    () => (items || []).filter(i => i.date === selected).sort((a, b) => (a.id || 0) - (b.id || 0)),
    [items, selected],
  );
  const totals = dayItems.reduce((acc, i) => ({
    calories: acc.calories + (i.calories || 0),
    protein: acc.protein + (i.protein || 0),
    carbs: acc.carbs + (i.carbs || 0),
    fat: acc.fat + (i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
          {days.map(d => {
            const active = d === selected;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                style={{
                  flex: '1 0 40px', padding: '7px 4px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                {dayChipLabel(d, today)}
              </button>
            );
          })}
        </div>
        <input
          type="date"
          max={today}
          value={selected}
          onChange={e => e.target.value && setSelected(e.target.value)}
          aria-label="Pick a date"
          style={{
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: 12, padding: '6px 8px', fontFamily: 'inherit', flexShrink: 0,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{dayFullLabel(selected, today)}</span>
        {dayItems.length > 0 && (
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            {totals.calories} cal · {totals.protein}p · {totals.carbs}c · {totals.fat}f
          </span>
        )}
      </div>

      {items === null ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Loading&hellip;</p>
      ) : dayItems.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Nothing logged {dayFullLabel(selected, today) === 'Today' ? 'yet today' : 'that day'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dayItems.map(i => (
            <DayMealRow key={i.id} item={i} onSave={onSave} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
