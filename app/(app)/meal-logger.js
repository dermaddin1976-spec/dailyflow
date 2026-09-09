'use client';
import { useState, useEffect, useRef } from 'react';
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

// Downsize a photo before it's stored with the log entry — a full-resolution
// phone photo on every meal would bloat the database fast, and this only
// needs to be big enough to recognize what you ate at a glance.
function resizeForStorage(base64, mimeType, maxWidth = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// The logging form only — what you've already logged is shown once, by the
// day picker above this (NutritionDayPicker, wired up in nutrition-client.js),
// which also handles editing and deleting.
export default function MealLogger({ onLogged }) {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');

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

  const [describeOpen, setDescribeOpen] = useState(false);
  const [describeText, setDescribeText] = useState('');

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
        photo_data_url: photoDataUrl || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setDescription(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setEstimateMsg(''); setPhotoDataUrl('');
    setSavedFlash('Saved.');
    setTimeout(() => setSavedFlash(''), 1500);
    onLogged();
    router.refresh();
  }

  async function applyEstimate(base64, mimeType) {
    setEstimating(true); setEstimateMsg('');
    // Keep a smaller copy of the photo attached to this entry regardless of
    // whether the AI estimate below succeeds — the user still took the photo.
    resizeForStorage(base64, mimeType).then(setPhotoDataUrl).catch(() => {});
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

  async function applyTextEstimate() {
    if (!describeText.trim()) { setEstimateMsg('Describe what you ate first.'); return; }
    setEstimating(true); setEstimateMsg('');
    try {
      const res = await fetch('/api/ai/estimate-meal-from-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: describeText }),
      });
      const data = await res.json();
      if (!res.ok) { setEstimateMsg(data.error || 'Estimate failed.'); return; }
      setDescription(data.description || '');
      setCalories(data.calories ? String(data.calories) : '');
      setProtein(data.protein ? String(data.protein) : '');
      setCarbs(data.carbs ? String(data.carbs) : '');
      setFat(data.fat ? String(data.fat) : '');
      setEstimateMsg(`DailyAI estimate (${data.confidence || 'medium'} confidence) — review before saving.`);
      setDescribeOpen(false);
      setDescribeText('');
    } catch (err) {
      setEstimateMsg('Something went wrong estimating that.');
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

  return (
    <form className="card" onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Log a meal</h3>
        <InfoTip>
          DailyAI reads your photo, or your written description if you forgot to log something at the time, and
          takes a guess at calories, protein, carbs and fat &mdash; it's a starting point, not a lab measurement, so
          check the numbers (and confidence note) before saving.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      {cameraOpen ? (
        <div style={{ marginTop: 11 }}>
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
        <div style={{ marginTop: 11 }}>
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
      ) : describeOpen ? (
        <div style={{ marginTop: 11 }}>
          <textarea
            value={describeText}
            onChange={e => setDescribeText(e.target.value)}
            placeholder="e.g. Two slices of homemade pizza with pepperoni, and a side salad"
            rows={3}
            style={{
              width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', color: 'var(--text)', padding: '8px 10px', fontSize: 13,
              fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn secondary wide" onClick={() => { setDescribeOpen(false); setDescribeText(''); setEstimateMsg(''); }}>Cancel</button>
            <button type="button" className="btn wide" onClick={applyTextEstimate} disabled={estimating}>
              {estimating ? (<><span className="spinner" />Estimating…</>) : 'Estimate'}
            </button>
          </div>
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
          <button type="button" className="btn secondary wide" onClick={() => setDescribeOpen(true)} disabled={estimating}>
            Describe it
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
      {photoDataUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
          <img src={photoDataUrl} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }} />
          <button type="button" onClick={() => setPhotoDataUrl('')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Remove photo
          </button>
        </div>
      )}
      <button className="btn wide" style={{ marginTop: 14 }} type="submit">Save meal</button>
    </form>
  );
}
