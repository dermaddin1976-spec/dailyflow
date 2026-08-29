'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import InfoTip from './info-tip.js';
import StudyNotes from './study-notes.js';
import AskPanel from './ask-panel.js';

const fieldStyle = {
  width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13.5,
  fontFamily: 'inherit', resize: 'vertical',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function EditableCard({ card, onSave, onDelete }) {
  const [question, setQuestion] = useState(card.question);
  const [answer, setAnswer] = useState(card.answer);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(card.id, question, answer);
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Question</label>
        <button onClick={() => onDelete(card.id)} aria-label="Delete card" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15 }}>&times;</button>
      </div>
      <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={fieldStyle} />
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginTop: 10, display: 'block' }}>Answer</label>
      <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={2} style={{ ...fieldStyle, marginTop: 6 }} />
      <button className="btn secondary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save changes'}
      </button>
    </div>
  );
}

function AddCardForm({ deckTitle, onAdd }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    await onAdd(deckTitle, question, answer);
    setQuestion(''); setAnswer('');
    setSaving(false);
  }

  return (
    <form className="card" onSubmit={submit} style={{ border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
      <h3 style={{ marginBottom: 10 }}>Add a card</h3>
      <textarea placeholder="Question" value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={fieldStyle} />
      <textarea placeholder="Answer" value={answer} onChange={e => setAnswer(e.target.value)} rows={2} style={{ ...fieldStyle, marginTop: 8 }} />
      <button className="btn wide" style={{ marginTop: 12 }} type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add card'}</button>
    </form>
  );
}

export default function StudyWorkspace() {
  const [allCards, setAllCards] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [processingVideo, setProcessingVideo] = useState(false);
  const [activeDeck, setActiveDeck] = useState(null);
  const [mode, setMode] = useState('review'); // 'review' | 'quiz' | 'manage'
  const [manageIndex, setManageIndex] = useState(0);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [manageSavedFlash, setManageSavedFlash] = useState(false);

  const [fullDeckSize, setFullDeckSize] = useState(0);
  const [passCards, setPassCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [missed, setMissed] = useState([]);
  const [revealed, setRevealed] = useState(false);

  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizMsg, setQuizMsg] = useState('');

  const refresh = useCallback(() => {
    fetch('/api/flashcards').then(r => r.json()).then(d => setAllCards(d.cards || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const decks = useMemo(() => {
    const grouped = {};
    allCards.forEach(c => {
      grouped[c.source_title] = grouped[c.source_title] || [];
      grouped[c.source_title].push(c);
    });
    return grouped;
  }, [allCards]);

  useEffect(() => {
    if (mode !== 'manage' || !activeDeck) return;
    const cards = decks[activeDeck] || [];
    const c = cards[Math.min(manageIndex, Math.max(0, cards.length - 1))];
    if (c) { setEditQuestion(c.question); setEditAnswer(c.answer); }
  }, [mode, activeDeck, manageIndex, decks]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/ai/flashcards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, title: file.name.replace(/\.pdf$/i, '') }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setMsg(`Created ${data.count} flashcards.`);
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
      const res = await fetch('/api/ai/flashcards-from-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setMsg(`Created ${data.count} flashcards from "${data.title}".`);
      setYoutubeUrl('');
      refresh();
    } catch (err) {
      setMsg('Something went wrong reaching that video.');
    } finally {
      setProcessingVideo(false);
    }
  }

  async function deleteDeck(title) {
    if (!window.confirm(`Delete the "${title}" deck and all its cards? This can't be undone.`)) return;
    await fetch(`/api/flashcards?title=${encodeURIComponent(title)}`, { method: 'DELETE' });
    refresh();
  }

  async function saveCard(id, question, answer) {
    await fetch(`/api/flashcards/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer }),
    });
    refresh();
  }

  async function deleteCard(id) {
    await fetch(`/api/flashcards/${id}`, { method: 'DELETE' });
    refresh();
  }

  async function addCard(deckTitle, question, answer) {
    await fetch('/api/flashcards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_title: deckTitle, question, answer }),
    });
    refresh();
  }

  function openDeck(title) {
    const cards = decks[title];
    setActiveDeck(title);
    setMode('review');
    setFullDeckSize(cards.length);
    setPassCards(cards);
    setIndex(0);
    setMissed([]);
    setRevealed(false);
  }

  function manageDeck(title) {
    setActiveDeck(title);
    setMode('manage');
    setManageIndex(0);
  }

  function askDeck(title) {
    setActiveDeck(title);
    setMode('ask');
  }

  function startPass(cards) {
    setPassCards(cards);
    setIndex(0);
    setMissed([]);
    setRevealed(false);
  }

  function answer(correct) {
    if (!correct) setMissed(m => [...m, passCards[index]]);
    setRevealed(false);
    setIndex(i => i + 1);
  }

  async function fetchQuiz(title) {
    const res = await fetch(`/api/quiz?title=${encodeURIComponent(title)}`);
    const data = await res.json();
    return data.questions || [];
  }

  async function startQuiz(title) {
    setActiveDeck(title);
    setMode('quiz');
    setQuizMsg('');
    setQuizLoading(true);
    let questions = await fetchQuiz(title);
    if (questions.length === 0) {
      const genRes = await fetch('/api/ai/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) { setQuizMsg(genData.error || 'Quiz generation failed.'); setQuizLoading(false); return; }
      questions = await fetchQuiz(title);
    }
    setQuizQuestions(questions);
    setQuizIndex(0); setQuizScore(0); setSelected(null);
    setQuizLoading(false);
  }

  async function regenerateQuiz(title) {
    setQuizLoading(true); setQuizMsg('');
    const genRes = await fetch('/api/ai/quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    });
    const genData = await genRes.json();
    if (!genRes.ok) { setQuizMsg(genData.error || 'Quiz generation failed.'); setQuizLoading(false); return; }
    const questions = await fetchQuiz(title);
    setQuizQuestions(questions);
    setQuizIndex(0); setQuizScore(0); setSelected(null);
    setQuizLoading(false);
  }

  function selectOption(i) {
    if (selected !== null) return;
    setSelected(i);
    if (i === quizQuestions[quizIndex].correctIndex) setQuizScore(s => s + 1);
  }

  function nextQuestion() {
    setSelected(null);
    setQuizIndex(i => i + 1);
  }

  function retakeQuiz() {
    setQuizIndex(0); setQuizScore(0); setSelected(null);
  }

  function backToDecks() {
    setActiveDeck(null); setPassCards([]); setIndex(0); setMissed([]); setRevealed(false);
    setQuizQuestions([]); setQuizIndex(0); setQuizScore(0); setSelected(null);
    refresh();
  }

  if (activeDeck && mode === 'manage') {
    const cards = decks[activeDeck] || [];
    const clampedIndex = cards.length ? Math.min(manageIndex, cards.length - 1) : 0;
    const currentCard = cards[clampedIndex];

    async function saveCurrent() {
      if (!currentCard) return;
      await saveCard(currentCard.id, editQuestion, editAnswer);
      setManageSavedFlash(true);
      setTimeout(() => setManageSavedFlash(false), 1200);
    }

    async function deleteCurrent() {
      if (!currentCard) return;
      const wasLast = clampedIndex === cards.length - 1;
      await deleteCard(currentCard.id);
      if (wasLast) setManageIndex(i => Math.max(0, i - 1));
    }

    const editFieldStyle = {
      width: '100%', border: 'none', outline: 'none', background: 'transparent',
      color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5, resize: 'none',
    };

    return (
      <div>
        <button className="btn secondary" onClick={backToDecks} style={{ marginBottom: 20 }}>&larr; Back to decks</button>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{activeDeck} &mdash; Edit cards</h1>

        {currentCard ? (
          <div>
            <p className="mono" style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
              Card {clampedIndex + 1} / {cards.length}
            </p>
            <div className="card flashcard-edit-card" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Question</span>
                <button onClick={deleteCurrent} aria-label="Delete card" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>&times;</button>
              </div>
              <textarea
                value={editQuestion}
                onChange={e => setEditQuestion(e.target.value)}
                rows={3}
                style={{ ...editFieldStyle, fontSize: 20, marginTop: 10 }}
              />
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Answer</span>
              <textarea
                value={editAnswer}
                onChange={e => setEditAnswer(e.target.value)}
                rows={5}
                style={{ ...editFieldStyle, fontSize: 17, marginTop: 10, flex: 1 }}
              />
            </div>
            <div className="btn-row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn secondary" disabled={clampedIndex === 0} onClick={() => setManageIndex(i => i - 1)}>&larr; Previous</button>
              <button className="btn" onClick={saveCurrent}>{manageSavedFlash ? 'Saved' : 'Save changes'}</button>
              <button className="btn secondary" disabled={clampedIndex === cards.length - 1} onClick={() => setManageIndex(i => i + 1)}>Next &rarr;</button>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>No cards left in this deck.</p>
        )}

        <div style={{ marginTop: 28 }}>
          <AddCardForm deckTitle={activeDeck} onAdd={addCard} />
        </div>
      </div>
    );
  }

  if (activeDeck && mode === 'review') {
    const card = passCards[index];
    const finished = index >= passCards.length;

    return (
      <div>
        <button className="btn secondary" onClick={backToDecks} style={{ marginBottom: 20 }}>&larr; Back to decks</button>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{activeDeck}</h1>

        {!finished ? (
          <div>
            <div className="flip-container">
              <div className={`flip-card${revealed ? ' flipped' : ''}`} onClick={() => setRevealed(r => !r)}>
                <div className="flip-face flip-front">{card.question}</div>
                <div className="flip-face flip-back">{card.answer}</div>
              </div>
            </div>
            {!revealed ? (
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, marginTop: 10 }}>Click the card to reveal the answer</p>
            ) : (
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="btn secondary wide" onClick={() => answer(false)}>Didn&rsquo;t know it</button>
                <button className="btn wide" onClick={() => answer(true)}>Got it</button>
              </div>
            )}
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 16 }} className="mono">
              {index + 1} / {passCards.length}
            </p>
          </div>
        ) : missed.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 36 }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>You got every card. 🎉</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 18 }}>{fullDeckSize} card{fullDeckSize === 1 ? '' : 's'}, all correct.</p>
            <button className="btn secondary" onClick={() => startPass(decks[activeDeck])}>Go again</button>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 36 }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>
              {passCards.length - missed.length} / {passCards.length} correct.
            </p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 18 }}>
              You missed {missed.length} card{missed.length === 1 ? '' : 's'} — go through just those?
            </p>
            <button className="btn wide" onClick={() => startPass(missed)}>Review the {missed.length} you missed</button>
          </div>
        )}
      </div>
    );
  }

  if (activeDeck && mode === 'ask') {
    const cards = decks[activeDeck] || [];
    const context = [
      `Flashcard deck: ${activeDeck}`,
      ...cards.map((c, i) => `Q${i + 1}: ${c.question}\nA${i + 1}: ${c.answer}`),
    ].join('\n\n');

    return (
      <div>
        <button className="btn secondary" onClick={backToDecks} style={{ marginBottom: 20 }}>&larr; Back to decks</button>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{activeDeck} &mdash; Ask about this</h1>
        <AskPanel
          context={context}
          placeholder={`Ask anything about the "${activeDeck}" deck \u2014 DailyAI will answer using these cards.`}
        />
      </div>
    );
  }

  if (activeDeck && mode === 'quiz') {
    const q = quizQuestions[quizIndex];
    const finished = !quizLoading && quizQuestions.length > 0 && quizIndex >= quizQuestions.length;
    const optionLabels = ['A', 'B', 'C', 'D'];

    return (
      <div>
        <button className="btn secondary" onClick={backToDecks} style={{ marginBottom: 20 }}>&larr; Back to decks</button>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{activeDeck} &mdash; Quiz</h1>

        {quizLoading && (
          <div className="card" style={{ textAlign: 'center', padding: 36 }}>
            <p><span className="spinner" />Generating quiz questions&hellip;</p>
          </div>
        )}

        {!quizLoading && quizMsg && <p className="error-text">{quizMsg}</p>}

        {!quizLoading && !quizMsg && q && !finished && (
          <div>
            <p className="mono" style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
              Question {quizIndex + 1} / {quizQuestions.length}
            </p>
            <div className="card" style={{ marginBottom: 18, fontSize: 17 }}>{q.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map((opt, i) => {
                let bg = 'var(--surface)';
                let border = 'var(--border-strong)';
                if (selected !== null) {
                  if (i === q.correctIndex) { bg = 'color-mix(in srgb, var(--good) 16%, var(--surface))'; border = 'var(--good)'; }
                  else if (i === selected) { bg = 'color-mix(in srgb, var(--critical) 14%, var(--surface))'; border = 'var(--critical)'; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => selectOption(i)}
                    disabled={selected !== null}
                    style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${border}`, background: bg, color: 'var(--text)', fontSize: 14.5,
                      display: 'flex', gap: 10, cursor: selected === null ? 'pointer' : 'default',
                    }}
                  >
                    <span className="mono" style={{ color: 'var(--muted)', fontWeight: 700 }}>{optionLabels[i]}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {selected !== null && (
              <button className="btn wide" style={{ marginTop: 20 }} onClick={nextQuestion}>
                {quizIndex + 1 === quizQuestions.length ? 'See results' : 'Next question'}
              </button>
            )}
          </div>
        )}

        {!quizLoading && !quizMsg && finished && (
          <div className="card" style={{ textAlign: 'center', padding: 36 }}>
            <p style={{ fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{quizScore} / {quizQuestions.length}</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>
              {quizScore === quizQuestions.length ? 'Perfect score.' : 'Not bad — try again or get a fresh set of questions.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={retakeQuiz}>Retake same quiz</button>
              <button className="btn secondary" onClick={() => regenerateQuiz(activeDeck)}>New questions</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h2 style={{ fontSize: 19, margin: 0 }}>Flashcards</h2>
        <InfoTip>
          <strong>Review</strong> flips through a deck's cards one at a time and makes you repeat any you get wrong
          until you've gotten through the whole thing clean. <strong>Quiz</strong> generates multiple-choice questions
          for a deck once, then reuses them so retakes load instantly. <strong>Edit cards</strong> lets you fix
          anything DailyAI got wrong when it read your notes or video &mdash; it's worth a quick check after generating.
          <strong>Ask about this</strong> opens a chat scoped to that deck's cards, for when you're stuck on a concept
          rather than just testing yourself on it.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 20, fontSize: 13.5 }}>Upload a PDF of your notes to get flashcards generated automatically, then quiz yourself on any deck with DailyAI-generated multiple-choice questions.</p>

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 24, alignItems: 'start' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>From a document</label>
            <label className="btn wide" style={{ display: 'inline-block', textAlign: 'center' }}>
              {uploading ? (<><span className="spinner" />Generating flashcards…</>) : 'Upload a PDF'}
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
                {processingVideo ? (<><span className="spinner" />Analyzing…</>) : 'Generate'}
              </button>
            </form>
          </div>
        </div>
        {msg && <p style={{ marginTop: 16, fontSize: 13, color: msg.startsWith('Created') ? 'var(--good)' : 'var(--critical)' }}>{msg}</p>}
        {uploading && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Reading through your notes and building flashcards — this is usually quick, a minute at most.
          </p>
        )}
        {processingVideo && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Watching the video and pulling out key points — this can take a few minutes for longer videos.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 18 }}>
        {Object.keys(decks).length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '48px 28px', border: '1px dashed var(--border-strong)', boxShadow: 'none', gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: 8 }}>No decks yet</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto' }}>
              Upload a PDF of your notes or paste a YouTube link above, and DailyFlow will turn it into a deck you can review or quiz yourself on.
            </p>
          </div>
        )}
        {Object.entries(decks).map(([title, cards]) => (
          <div key={title} className="card" style={{ border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <h3>{title}</h3>
              <button
                onClick={() => deleteDeck(title)}
                aria-label="Delete deck"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, padding: '0 2px', flexShrink: 0 }}
              >
                &times;
              </button>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>{cards.length} card{cards.length === 1 ? '' : 's'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn wide" onClick={() => openDeck(title)}>Review</button>
              <button className="btn secondary wide" onClick={() => startQuiz(title)}>Quiz</button>
            </div>
            <button
              className="btn secondary wide"
              onClick={() => askDeck(title)}
              style={{ marginTop: 8, borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              &#128172; Ask about this
            </button>
            <button
              onClick={() => manageDeck(title)}
              style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 12.5, marginTop: 12, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              Edit cards
            </button>
          </div>
        ))}
      </div>

      <StudyNotes />
    </div>
  );
}
