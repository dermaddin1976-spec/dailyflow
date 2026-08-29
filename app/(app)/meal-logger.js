'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import InfoTip from './info-tip.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }

const ZXING_SRC = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

function loadZXing() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window.'));
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${ZXING_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.ZXing));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = ZXING_SRC;
    script.onload = () => resolve(window.ZXing);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const miniFieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px',
  fontSize: 12.5, fontFamily: 'inherit', width: '100%',
};

function MealRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
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
    <div className="meal-row">
      <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5 }}>
          {[item.calories && `${item.calories} cal`, item.protein && `${item.protein}p`, item.carbs && `${item.carbs}c`, item.fat && `${item.fat}f`].filter(Boolean).join(' · ') || '—'}
        </span>
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit meal" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>&#9998;</button>
        <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete meal" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 0 }}>&times;</button>
      </span>
    </div>
  );
}

export default function MealLogger() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [items, setItems] = useState([]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerLoading, setScannerLoading] = useState(false);
  const scanVideoRef = useRef(null);
  const zxingReaderRef = useRef(null);

  const refresh = useCallback(() => {
    fetch('/api/logs/meal').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Stop the camera if the component unmounts while it's open.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      zxingReaderRef.current?.reset();
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/logs/meal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: todayStr(), description,
        calories: parseInt(calories, 10) || null,
        protein: parseInt(protein, 10) || null,
        carbs: parseInt(carbs, 10) || null,
        fat: parseInt(fat, 10) || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setDescription(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setEstimateMsg('');
    setSavedFlash('Saved.');
    setTimeout(() => setSavedFlash(''), 1500);
    refresh();
    router.refresh();
  }

  async function applyEstimate(base64, mimeType) {
    setEstimating(true); setEstimateMsg('');
    try {
      const res = await fetch('/api/ai/estimate-meal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) { setEstimateMsg(data.error || 'Estimate failed.'); return; }
      setDescription(data.description || '');
      setCalories(data.calories ? String(data.calories) : '');
      setProtein(data.protein ? String(data.protein) : '');
      setCarbs(data.carbs ? String(data.carbs) : '');
      setFat(data.fat ? String(data.fat) : '');
      setEstimateMsg(`DailyAI estimate (${data.confidence || 'medium'} confidence) — review before saving.`);
    } catch (err) {
      setEstimateMsg('Something went wrong reading that photo.');
    } finally {
      setEstimating(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const base64 = await fileToBase64(file);
    await applyEstimate(base64, file.type || 'image/jpeg');
  }

  async function applyBarcode(code) {
    setEstimating(true); setEstimateMsg('');
    try {
      const res = await fetch(`/api/nutrition/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) { setEstimateMsg(data.error || 'Product not found.'); return; }
      setDescription(data.description || '');
      setCalories(data.calories ? String(data.calories) : '');
      setProtein(data.protein ? String(data.protein) : '');
      setCarbs(data.carbs ? String(data.carbs) : '');
      setFat(data.fat ? String(data.fat) : '');
      setEstimateMsg(data.note || 'Found via barcode — review before saving.');
    } catch (err) {
      setEstimateMsg('Something went wrong looking up that barcode.');
    } finally {
      setEstimating(false);
    }
  }

  function closeScanner() {
    zxingReaderRef.current?.reset();
    zxingReaderRef.current = null;
    setScannerOpen(false);
  }

  async function openScanner() {
    setScannerError('');
    setScannerLoading(true);
    try {
      const ZXing = await loadZXing();
      setScannerOpen(true);
      setScannerLoading(false);
      const reader = new ZXing.BrowserMultiFormatReader();
      zxingReaderRef.current = reader;
      // Give the video element a tick to mount before ZXing attaches to it.
      setTimeout(() => {
        if (!scanVideoRef.current) return;
        reader.decodeFromVideoDevice(undefined, scanVideoRef.current, (result) => {
          if (result) {
            const code = result.getText();
            closeScanner();
            applyBarcode(code);
          }
        }).catch(() => {
          setScannerError('Could not open the camera for scanning — check permissions, or type the item in manually.');
          closeScanner();
        });
      }, 50);
    } catch (err) {
      setScannerLoading(false);
      setScannerError('Could not load the barcode scanner — check your connection and try again.');
    }
  }

  async function openCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      setCameraError('Could not open the camera — check your browser/system camera permissions, or upload a photo instead.');
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    closeCamera();
    await applyEstimate(dataUrl.split(',')[1], 'image/jpeg');
  }

  async function saveMeal(id, fields) {
    await fetch(`/api/logs/meal/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: fields.description,
        calories: parseInt(fields.calories, 10) || null,
        protein: parseInt(fields.protein, 10) || null,
        carbs: parseInt(fields.carbs, 10) || null,
        fat: parseInt(fields.fat, 10) || null,
      }),
    });
    refresh();
    router.refresh();
  }

  async function deleteMeal(id) {
    await fetch(`/api/logs/meal/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Log a meal</h3>
        <InfoTip>
          DailyAI reads your photo and takes a guess at what's in it, along with calories, protein, carbs and fat
          &mdash; it's a starting point, not a lab measurement, so check the numbers (and confidence note) before saving.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      {cameraOpen ? (
        <div style={{ marginTop: 14 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: 360, objectFit: 'cover' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn secondary wide" onClick={closeCamera}>Cancel</button>
            <button type="button" className="btn wide" onClick={capturePhoto} disabled={estimating}>
              {estimating ? (<><span className="spinner" />Estimating…</>) : 'Capture'}
            </button>
          </div>
        </div>
      ) : scannerOpen ? (
        <div style={{ marginTop: 14 }}>
          <video
            ref={scanVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: 320, objectFit: 'cover' }}
          />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>Point the camera at the barcode.</p>
          <button type="button" className="btn secondary wide" style={{ marginTop: 2 }} onClick={closeScanner}>Cancel</button>
        </div>
      ) : (
        <div className="action-grid">
          <button type="button" className="btn secondary wide" onClick={openCamera} disabled={estimating}>
            {estimating ? (<><span className="spinner" />Estimating…</>) : 'Take a photo'}
          </button>
          <label className="btn secondary wide" style={{ display: 'inline-block', textAlign: 'center' }}>
            Upload a photo
            <input type="file" accept="image/*" onChange={handleFile} disabled={estimating} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn secondary wide" onClick={openScanner} disabled={estimating || scannerLoading}>
            {scannerLoading ? (<><span className="spinner" />Loading…</>) : 'Scan a barcode'}
          </button>
        </div>
      )}
      {cameraError && <p style={{ fontSize: 12, color: 'var(--critical)', marginTop: 8 }}>{cameraError}</p>}
      {scannerError && <p style={{ fontSize: 12, color: 'var(--critical)', marginTop: 8 }}>{scannerError}</p>}
      {estimateMsg && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{estimateMsg}</p>}
      {msg && <p className="error-text">{msg}</p>}
      <div className="field">
        <label>What did you eat?</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Chicken, rice, veg" required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 4 }}>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Calories</label>
          <input type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Protein (g)</label>
          <input type="number" min="0" value={protein} onChange={e => setProtein(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Carbs (g)</label>
          <input type="number" min="0" value={carbs} onChange={e => setCarbs(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Fat (g)</label>
          <input type="number" min="0" value={fat} onChange={e => setFat(e.target.value)} />
        </div>
      </div>
      <button className="btn wide" style={{ marginTop: 18 }} type="submit">Save meal</button>

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>Nothing logged yet.</p>
      ) : (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.slice(0, 8).map(i => (
            <MealRow key={i.id} item={i} onSave={saveMeal} onDelete={deleteMeal} />
          ))}
        </div>
      )}
    </form>
  );
}
