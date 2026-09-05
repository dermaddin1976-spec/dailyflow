'use client';
import { useState, useEffect, useCallback } from 'react';
import InfoTip from './info-tip.js';
import AskPanel from './ask-panel.js';
import { GROCERY_STORE_OPTIONS, KITCHEN_TOOL_OPTIONS, splitKnownOther, joinKnownOther } from './pantry-options.js';
import KitchenPicker from './kitchen-picker.js';

const CURRENCIES = [
  { value: 'EUR', symbol: '€' },
  { value: 'USD', symbol: '$' },
  { value: 'GBP', symbol: '£' },
];

const DIET_OPTIONS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Dairy-free', 'Gluten-free'];

const COOKING_TIME_OPTIONS = [
  { value: 'quick', label: 'Quick (<15 min)' },
  { value: 'moderate', label: 'Moderate (15–30 min)' },
  { value: 'none', label: 'No limit' },
];

const CONTEXT_OPTIONS = ['Post-workout', 'Pre-workout', 'Late night', 'On the go'];

const BUILD_LABELS = {
  plan: 'Build my plan',
  meal: 'Build my meal',
  snack: 'Build my snack',
  grab: 'Find something to grab',
};

function currencySymbol(code) {
  return (CURRENCIES.find(c => c.value === code) || {}).symbol || code || '';
}

const inputStyle = {
  width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)', color: 'var(--text)', padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit',
};

function ChoicePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: 'var(--radius-pill)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Bubble({ children }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '16px 18px', fontSize: 14.5, lineHeight: 1.5, marginBottom: 18,
    }}>
      {children}
    </div>
  );
}

const DEFAULT_ANSWERS = {
  scope: 'plan', mealType: 'any', context: '', grabStore: '',
  groceryStores: [], groceryStoreOther: '',
  kitchenToolsList: [], kitchenToolsOther: '',
  days: 5, mealsPerDay: 3, includeSnacks: false,
  diet: [], dietOther: '', allergies: '', cuisines: '',
  cookingTime: 'moderate', servings: 1,
  budgetAmount: '', currency: 'EUR', extraNotes: '',
};

function stepsForScope(scope) {
  if (scope === 'meal') return ['scope', 'store', 'kitchen', 'mealType', 'diet', 'allergies', 'notes'];
  if (scope === 'snack') return ['scope', 'store', 'kitchen', 'diet', 'allergies', 'notes'];
  if (scope === 'grab') return ['scope', 'grabStore', 'diet', 'allergies', 'notes'];
  return ['scope', 'store', 'kitchen', 'days', 'meals', 'diet', 'allergies', 'cuisines', 'cookingTime', 'servings', 'budget', 'notes'];
}

function Wizard({ onCancel, onComplete, groceryStore, kitchenTools }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const gs = splitKnownOther(groceryStore, GROCERY_STORE_OPTIONS);
    const kt = splitKnownOther(kitchenTools, KITCHEN_TOOL_OPTIONS);
    return {
      ...DEFAULT_ANSWERS,
      groceryStores: gs.known,
      groceryStoreOther: gs.other,
      kitchenToolsList: kt.known,
      kitchenToolsOther: kt.other,
    };
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const steps = stepsForScope(answers.scope);
  const stepCount = steps.length;
  const stepKey = steps[step] || steps[steps.length - 1];

  function update(patch) { setAnswers(a => ({ ...a, ...patch })); }
  function toggleDiet(opt) {
    setAnswers(a => ({ ...a, diet: a.diet.includes(opt) ? a.diet.filter(d => d !== opt) : [...a.diet, opt] }));
  }
  function toggleStore(opt) {
    setAnswers(a => ({ ...a, groceryStores: a.groceryStores.includes(opt) ? a.groceryStores.filter(s => s !== opt) : [...a.groceryStores, opt] }));
  }
  function toggleTool(opt) {
    setAnswers(a => ({ ...a, kitchenToolsList: a.kitchenToolsList.includes(opt) ? a.kitchenToolsList.filter(t => t !== opt) : [...a.kitchenToolsList, opt] }));
  }
  function setScope(scope) { setAnswers(a => ({ ...a, scope })); setStep(0); }
  function setContext(c) { setAnswers(a => ({ ...a, context: a.context === c ? '' : c })); }
  function next() {
    if (stepKey === 'store') {
      const joined = joinKnownOther(answers.groceryStores, answers.groceryStoreOther);
      if (joined !== (groceryStore || '')) {
        fetch('/api/me', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grocery_store: joined }),
        }).catch(() => {});
      }
    }
    if (stepKey === 'kitchen') {
      const joined = joinKnownOther(answers.kitchenToolsList, answers.kitchenToolsOther);
      if (joined !== (kitchenTools || '')) {
        fetch('/api/me', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kitchen_tools: joined }),
        }).catch(() => {});
      }
    }
    setStep(s => Math.min(stepCount - 1, s + 1));
  }
  function back() { setStep(s => Math.max(0, s - 1)); }

  async function generate() {
    setGenerating(true); setError('');
    try {
      const payload = {
        ...answers,
        groceryStore: joinKnownOther(answers.groceryStores, answers.groceryStoreOther),
        kitchenTools: joinKnownOther(answers.kitchenToolsList, answers.kitchenToolsOther),
        budgetAmount: answers.budgetAmount ? Number(answers.budgetAmount) : null,
      };
      const res = await fetch('/api/ai/meal-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setGenerating(false); return; }
      onComplete(data.id);
    } catch (err) {
      setError('Something went wrong building your plan.');
      setGenerating(false);
    }
  }

  if (generating) {
    const loadingText = answers.scope === 'meal'
      ? `Building your ${answers.mealType && answers.mealType !== 'any' ? answers.mealType : 'meal'}…`
      : answers.scope === 'snack'
      ? 'Building your snack…'
      : answers.scope === 'grab'
      ? 'Finding something quick to grab…'
      : `Building your ${answers.days}-day plan and shopping list…`;
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p><span className="spinner" />{loadingText}</p>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>
          {answers.scope === 'plan' ? 'This can take a minute or two for a full week.' : 'This should just take a few seconds.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p className="mono" style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0 }}>Question {step + 1} of {stepCount}</p>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
      </div>

      {stepKey === 'scope' && (
        <div>
          <Bubble>What do you want to plan?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ChoicePill active={answers.scope === 'plan'} onClick={() => setScope('plan')}>Full meal plan</ChoicePill>
            <ChoicePill active={answers.scope === 'meal'} onClick={() => setScope('meal')}>Just one meal</ChoicePill>
            <ChoicePill active={answers.scope === 'snack'} onClick={() => setScope('snack')}>Just a snack</ChoicePill>
            <ChoicePill active={answers.scope === 'grab'} onClick={() => setScope('grab')}>Grab something quick (no cooking)</ChoicePill>
          </div>
        </div>
      )}

      {stepKey === 'store' && (
        <div>
          <Bubble>Which stores do you shop at? Tap all that apply &mdash; this keeps ingredients realistic. Optional.</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {GROCERY_STORE_OPTIONS.map(opt => (
              <ChoicePill key={opt} active={answers.groceryStores.includes(opt)} onClick={() => toggleStore(opt)}>{opt}</ChoicePill>
            ))}
          </div>
          <input value={answers.groceryStoreOther} onChange={e => update({ groceryStoreOther: e.target.value })} placeholder="Other store not listed? (optional)" style={inputStyle} />
        </div>
      )}

      {stepKey === 'kitchen' && (
        <div>
          <Bubble>What kitchen tools do you have? Tap an appliance in the picture &mdash; recipes will stick to what you can actually use. Optional.</Bubble>
          <KitchenPicker selected={answers.kitchenToolsList} onToggle={toggleTool} />
          <input value={answers.kitchenToolsOther} onChange={e => update({ kitchenToolsOther: e.target.value })} placeholder="Something else not pictured? (optional)" style={{ ...inputStyle, marginTop: 14 }} />
        </div>
      )}

      {stepKey === 'grabStore' && (
        <div>
          <Bubble>Which store are you at or heading to right now?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {GROCERY_STORE_OPTIONS.map(opt => (
              <ChoicePill key={opt} active={answers.grabStore === opt} onClick={() => update({ grabStore: opt })}>{opt}</ChoicePill>
            ))}
          </div>
          <input
            value={answers.grabStore && !GROCERY_STORE_OPTIONS.includes(answers.grabStore) ? answers.grabStore : ''}
            onChange={e => update({ grabStore: e.target.value })}
            placeholder="Somewhere else? Type it here"
            style={inputStyle}
          />
        </div>
      )}

      {stepKey === 'mealType' && (
        <div>
          <Bubble>Which meal is this for?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['any', 'Doesn’t matter']].map(([v, l]) => (
              <ChoicePill key={v} active={answers.mealType === v} onClick={() => update({ mealType: v })}>{l}</ChoicePill>
            ))}
          </div>
        </div>
      )}

      {stepKey === 'days' && (
        <div>
          <Bubble>How many days should this plan cover?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[3, 5, 7].map(n => <ChoicePill key={n} active={answers.days === n} onClick={() => update({ days: n })}>{n} days</ChoicePill>)}
          </div>
        </div>
      )}

      {stepKey === 'meals' && (
        <div>
          <Bubble>How many meals per day &mdash; not counting snacks?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[2, 3, 4].map(n => <ChoicePill key={n} active={answers.mealsPerDay === n} onClick={() => update({ mealsPerDay: n })}>{n} meals</ChoicePill>)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
            <input type="checkbox" checked={answers.includeSnacks} onChange={e => update({ includeSnacks: e.target.checked })} />
            Include one snack a day
          </label>
        </div>
      )}

      {stepKey === 'diet' && (
        <div>
          <Bubble>Any dietary style I should plan around?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {DIET_OPTIONS.map(opt => <ChoicePill key={opt} active={answers.diet.includes(opt)} onClick={() => toggleDiet(opt)}>{opt}</ChoicePill>)}
          </div>
          <input value={answers.dietOther} onChange={e => update({ dietOther: e.target.value })} placeholder="Anything else? (optional)" style={inputStyle} />
        </div>
      )}

      {stepKey === 'allergies' && (
        <div>
          <Bubble>Any allergies or foods to strictly avoid? These won&rsquo;t appear in anything, in any form.</Bubble>
          <input value={answers.allergies} onChange={e => update({ allergies: e.target.value })} placeholder="Peanuts, shellfish... (leave blank if none)" style={inputStyle} />
        </div>
      )}

      {stepKey === 'cuisines' && (
        <div>
          <Bubble>Any cuisines or foods you&rsquo;d like to see more of? Optional &mdash; sensible defaults otherwise.</Bubble>
          <input value={answers.cuisines} onChange={e => update({ cuisines: e.target.value })} placeholder="Italian, Middle Eastern, lots of rice..." style={inputStyle} />
        </div>
      )}

      {stepKey === 'cookingTime' && (
        <div>
          <Bubble>How much time do you want to spend cooking, per meal?</Bubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COOKING_TIME_OPTIONS.map(o => <ChoicePill key={o.value} active={answers.cookingTime === o.value} onClick={() => update({ cookingTime: o.value })}>{o.label}</ChoicePill>)}
          </div>
        </div>
      )}

      {stepKey === 'servings' && (
        <div>
          <Bubble>Who&rsquo;s this for &mdash; just you, or are you cooking for more people each meal?</Bubble>
          <input type="number" min="1" max="12" value={answers.servings} onChange={e => update({ servings: Math.max(1, parseInt(e.target.value, 10) || 1) })} style={{ ...inputStyle, maxWidth: 120 }} />
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>serving{answers.servings === 1 ? '' : 's'} per meal &mdash; the shopping list quantities scale with this.</p>
        </div>
      )}

      {stepKey === 'budget' && (
        <div>
          <Bubble>What&rsquo;s your budget for this plan&rsquo;s whole shopping list? Leave the amount blank for no strict limit.</Bubble>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={answers.currency} onChange={e => update({ currency: e.target.value })} style={{ ...inputStyle, width: 100 }}>
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.symbol} {c.value}</option>)}
            </select>
            <input type="number" min="0" step="1" value={answers.budgetAmount} onChange={e => update({ budgetAmount: e.target.value })} placeholder="No limit" style={inputStyle} />
          </div>
        </div>
      )}

      {stepKey === 'notes' && (
        <div>
          <Bubble>
            {answers.scope === 'plan'
              ? 'Anything else worth knowing before this gets built? Optional.'
              : 'Any side note for this one? Optional — e.g. just finished a workout and want a high-protein recovery bite, or you’re short on time.'}
          </Bubble>
          {answers.scope !== 'plan' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {CONTEXT_OPTIONS.map(c => (
                <ChoicePill key={c} active={answers.context === c} onClick={() => setContext(c)}>{c}</ChoicePill>
              ))}
            </div>
          )}
          <textarea
            value={answers.extraNotes}
            onChange={e => update({ extraNotes: e.target.value })}
            rows={3}
            placeholder={answers.scope === 'plan' ? "I meal prep on Sundays, I hate mushrooms, whatever's useful..." : "Anything else worth adding..."}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button type="button" className="btn secondary" onClick={back} disabled={step === 0}>&larr; Back</button>
        {step < stepCount - 1 ? (
          <button type="button" className="btn" onClick={next}>Next &rarr;</button>
        ) : (
          <button type="button" className="btn" onClick={generate}>{BUILD_LABELS[answers.scope] || 'Build'}</button>
        )}
      </div>
    </div>
  );
}

function ReviseSection({ planId, currency, onApplied }) {
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const symbol = currencySymbol(currency);

  async function generatePreview(e) {
    e.preventDefault();
    if (!instructions.trim() || loading) return;
    setLoading(true); setError(''); setPreview(null);
    try {
      const res = await fetch(`/api/meal-plans/${planId}/revise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      setPreview({ ...data.preview, answers: data.answers });
    } catch (err) {
      setError('Something went wrong building that revision.');
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setApplying(true);
    try {
      await fetch(`/api/meal-plans/${planId}/apply-revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      });
      setPreview(null);
      setInstructions('');
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 17, marginBottom: 6 }}>Revise this plan</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}>
        Describe a change and DailyAI rebuilds the plan around it &mdash; nothing is saved until you approve it below.
      </p>
      <form onSubmit={generatePreview} className="card" style={{ boxShadow: 'none', border: '1px dashed var(--border-strong)' }}>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={2}
          placeholder="e.g. no more Asian food, more variety, swap Tuesday's dinner for something vegetarian..."
          style={{
            width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)', color: 'var(--text)', padding: '10px 12px', fontSize: 13.5,
            fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <button className="btn secondary" type="submit" style={{ marginTop: 10 }} disabled={loading || !instructions.trim()}>
          {loading ? (<><span className="spinner" />Rebuilding…</>) : 'Preview changes'}
        </button>
        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      </form>

      {preview && (
        <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Preview</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {symbol}{Number(preview.estimatedTotalCost || 0).toFixed(2)} estimated
            </span>
          </div>
          {preview.notes && <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>{preview.notes}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {(preview.days || []).map((d, di) => (
              <details key={di} className="card" style={{ padding: 0, background: 'var(--surface-2)' }} open={di === 0}>
                <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>{d.day}</summary>
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.meals.map((m, mi) => (
                    <div key={mi} style={{ fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase' }}>{m.meal}</span>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <p style={{ color: 'var(--text-2)', fontSize: 12.5 }}>{m.description}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn secondary" onClick={() => setPreview(null)} disabled={applying}>Discard</button>
            <button className="btn" onClick={apply} disabled={applying}>{applying ? 'Applying…' : 'Apply this plan'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function budgetColor(cost, budgetAmount) {
  if (!budgetAmount || cost == null) return 'var(--text)';
  if (cost <= budgetAmount) return 'var(--good)';
  if (cost <= budgetAmount * 1.15) return 'var(--warning)';
  return 'var(--critical)';
}

function PlanDetail({ planId, onBack, onDeleted }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [checked, setChecked] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/meal-plans/${planId}`).then(r => r.json()).then(d => { setPlan(d.plan || null); setLoading(false); }).catch(() => setLoading(false));
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  function toggleChecked(key) { setChecked(c => ({ ...c, [key]: !c[key] })); }

  async function regenerate() {
    setRegenerating(true); setMsg('');
    const res = await fetch(`/api/meal-plans/${planId}`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Regeneration failed.'); setRegenerating(false); return; }
    setChecked({});
    await load();
    setRegenerating(false);
  }

  async function deletePlan() {
    if (!window.confirm("Delete this meal plan? This can't be undone.")) return;
    await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
    onDeleted();
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading&hellip;</p>;
  if (!plan) {
    return (
      <div>
        <button className="btn secondary" onClick={onBack} style={{ marginBottom: 20 }}>&larr; Back to plans</button>
        <p style={{ color: 'var(--muted)' }}>That plan is gone.</p>
      </div>
    );
  }

  const budgetAmount = plan.answers && plan.answers.budgetAmount ? Number(plan.answers.budgetAmount) : null;
  const currency = plan.currency || 'EUR';
  const symbol = currencySymbol(currency);

  const grouped = {};
  (plan.shoppingList || []).forEach(item => {
    grouped[item.category] = grouped[item.category] || [];
    grouped[item.category].push(item);
  });

  return (
    <div>
      <button className="btn secondary" onClick={onBack} style={{ marginBottom: 20 }}>&larr; Back to plans</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{plan.title}</h1>
        <div className="btn-row" style={{ alignItems: 'center' }}>
          <button className="btn secondary" onClick={regenerate} disabled={regenerating}>
            {regenerating ? (<><span className="spinner" />Regenerating…</>) : 'Regenerate'}
          </button>
          <button type="button" onClick={deletePlan} aria-label="Delete plan" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>&times;</button>
        </div>
      </div>
      {msg && <p className="error-text">{msg}</p>}

      <div className="card" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>ESTIMATED COST</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 2, color: budgetColor(plan.total_est_cost, budgetAmount) }}>
            {symbol}{plan.total_est_cost != null ? Number(plan.total_est_cost).toFixed(2) : '—'}
          </div>
        </div>
        {budgetAmount ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>BUDGET</div>
            <div className="mono" style={{ fontSize: 16, marginTop: 2 }}>{symbol}{budgetAmount}</div>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>No strict budget set</div>
        )}
      </div>

      {plan.notes && (
        <div className="card" style={{ marginBottom: 24, background: 'var(--surface-2)', boxShadow: 'none' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>{plan.notes}</p>
        </div>
      )}

      <h2 style={{ fontSize: 17, marginBottom: 14 }}>Meals</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {(plan.days || []).map((d, di) => (
          <details key={di} className="card" style={{ padding: 0 }} open={di === 0}>
            <summary style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 600 }}>{d.day}</summary>
            <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.meals.map((m, mi) => (
                <div key={mi} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.meal}</span>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{m.name}</div>
                      <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{m.description}</p>
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {m.calories} cal<br />{m.protein}p {m.carbs}c {m.fat}f
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <h2 style={{ fontSize: 17, marginBottom: 14 }}>Shopping list</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="card">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>{category}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, ii) => {
                const key = `${category}-${ii}`;
                const isChecked = !!checked[key];
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', opacity: isChecked ? 0.55 : 1 }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleChecked(key)} />
                    <span style={{ flex: 1, textDecoration: isChecked ? 'line-through' : 'none' }}>
                      {item.item} <span style={{ color: 'var(--muted)' }}>&middot; {item.quantity}</span>
                    </span>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>{symbol}{Number(item.estCost || 0).toFixed(2)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 12 }}>Checkboxes here aren&rsquo;t saved &mdash; they reset if you leave and come back.</p>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 17, marginBottom: 6 }}>Ask about this plan</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}>
          For questions only &mdash; it can't change your plan. To actually change it, use Revise below.
        </p>
        <AskPanel
          context={[
            `Meal plan: ${plan.title}`,
            plan.notes ? `Notes: ${plan.notes}` : '',
            ...(plan.days || []).map(d => `${d.day}:\n${d.meals.map(m => `- ${m.meal}: ${m.name} (${m.calories} cal, ${m.protein}p ${m.carbs}c ${m.fat}f) \u2014 ${m.description}`).join('\n')}`),
          ].filter(Boolean).join('\n\n')}
          placeholder="Ask DailyAI about substitutions, prep tips, or anything else about this plan."
        />
      </div>

      <ReviseSection planId={planId} currency={currency} onApplied={load} />
    </div>
  );
}

export default function MealPlanner({ targets, initialPlanId, groceryStore, kitchenTools }) {
  const [view, setView] = useState(initialPlanId ? 'detail' : 'list');
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(initialPlanId || null);
  const [loadingList, setLoadingList] = useState(true);

  const refresh = useCallback(() => {
    setLoadingList(true);
    fetch('/api/meal-plans').then(r => r.json()).then(d => { setPlans(d.plans || []); setLoadingList(false); }).catch(() => setLoadingList(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  function openPlan(id) { setActivePlanId(id); setView('detail'); }
  function handleComplete(id) { refresh(); openPlan(id); }
  function handleDeleted() { setView('list'); refresh(); }

  async function deletePlanFromList(id) {
    if (!window.confirm("Delete this meal plan? This can't be undone.")) return;
    await fetch(`/api/meal-plans/${id}`, { method: 'DELETE' });
    refresh();
  }

  if (view === 'wizard') {
    return <Wizard onCancel={() => setView('list')} onComplete={handleComplete} groceryStore={groceryStore} kitchenTools={kitchenTools} />;
  }
  if (view === 'detail' && activePlanId) {
    return <PlanDetail planId={activePlanId} onBack={() => setView('list')} onDeleted={handleDeleted} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>Meal planner</h2>
            <InfoTip>
              Answers a handful of quick questions, then builds a full multi-day meal plan around your daily targets
              from Settings &mdash; matched to your diet, allergies, cooking time, and budget &mdash; plus one
              consolidated shopping list with estimated costs. "Regenerate" rebuilds a plan from the same answers
              if you want a fresh set of meals without redoing the questions.
            </InfoTip>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginTop: 4 }}>
            Built around your targets: {targets.calories} cal &middot; {targets.protein}p {targets.carbs}c {targets.fat}f per day
          </p>
        </div>
        <button className="btn" onClick={() => setView('wizard')}>New meal plan</button>
      </div>

      {loadingList ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading&hellip;</p>
      ) : plans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 28px', border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
          <h3 style={{ marginBottom: 8 }}>No plans yet</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto' }}>
            Answer a few quick questions and DailyFlow will build you a meal plan and shopping list.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 18 }}>
          {plans.map(p => (
            <div key={p.id} className="card" style={{ border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h3 style={{ fontSize: 15 }}>{p.title}</h3>
                <button
                  onClick={() => deletePlanFromList(p.id)}
                  aria-label="Delete plan"
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, padding: '0 2px', flexShrink: 0 }}
                >
                  &times;
                </button>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginBottom: 4 }}>{p.budget}</p>
              {p.total_est_cost != null && (
                <p className="mono" style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
                  {currencySymbol(p.currency)}{Number(p.total_est_cost).toFixed(2)} estimated
                </p>
              )}
              <button className="btn secondary wide" onClick={() => openPlan(p.id)}>View plan</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
