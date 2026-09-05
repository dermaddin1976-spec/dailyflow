'use client';

function Badge({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r="9" fill="var(--accent)" />
      <path d="M -4 0 L -1 3 L 4 -4" stroke="var(--accent-ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Glow({ x, y, w, h, active }) {
  if (!active) return null;
  return (
    <rect
      x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx="12"
      fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"
    />
  );
}

// A small clickable cartoon kitchen. Tap an appliance to toggle whether you
// have one. `selected` is an array of labels from KITCHEN_TOOL_OPTIONS.
export default function KitchenPicker({ selected, onToggle }) {
  const has = (k) => selected.includes(k);

  return (
    <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
      <svg viewBox="0 0 640 260" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <style>{`
          .kp-item { cursor: pointer; }
          .kp-item:hover .kp-shape { filter: brightness(1.15); }
        `}</style>

        <rect x="0" y="0" width="640" height="190" fill="var(--surface-2)" />
        <rect x="0" y="190" width="640" height="14" fill="#8a5a34" />
        <rect x="0" y="204" width="640" height="56" fill="var(--surface-3)" />
        <line x1="160" y1="204" x2="160" y2="260" stroke="var(--border)" strokeWidth="2" />
        <line x1="480" y1="204" x2="480" y2="260" stroke="var(--border)" strokeWidth="2" />

        {/* Microwave */}
        <g className="kp-item" onClick={() => onToggle('Microwave')}>
          <Glow x={20} y={140} w={90} h={50} active={has('Microwave')} />
          <rect x="4" y="128" width="112" height="72" fill="transparent" />
          <g className="kp-shape">
            <rect x="20" y="140" width="90" height="50" rx="4" fill="#2c2c31" stroke="var(--border)" />
            <rect x="28" y="147" width="58" height="36" rx="2" fill="#111318" />
            <circle cx="96" cy="152" r="3" fill="var(--accent)" />
            <circle cx="96" cy="162" r="3" fill="var(--muted)" />
          </g>
          {has('Microwave') && <Badge x={104} y={136} />}
          <text x="65" y="126" textAnchor="middle" fontSize="11" fill="var(--text-2)">Microwave</text>
        </g>

        {/* Air fryer */}
        <g className="kp-item" onClick={() => onToggle('Air fryer')}>
          <Glow x={130} y={128} w={70} h={62} active={has('Air fryer')} />
          <rect x="114" y="112" width="102" height="86" fill="transparent" />
          <g className="kp-shape">
            <rect x="130" y="128" width="70" height="62" rx="14" fill="#3a3a40" stroke="var(--border)" />
            <circle cx="165" cy="150" r="16" fill="#111318" />
            <rect x="145" y="176" width="40" height="6" rx="3" fill="var(--muted)" />
          </g>
          {has('Air fryer') && <Badge x={194} y={124} />}
          <text x="165" y="114" textAnchor="middle" fontSize="11" fill="var(--text-2)">Air fryer</text>
        </g>

        {/* Stovetop (built into the counter, above the oven) */}
        <g className="kp-item" onClick={() => onToggle('Stovetop')}>
          <Glow x={230} y={172} w={180} h={18} active={has('Stovetop')} />
          <rect x="220" y="160" width="200" height="38" fill="transparent" />
          <g className="kp-shape">
            <rect x="230" y="176" width="180" height="14" rx="3" fill="#111318" stroke="var(--border)" />
            <circle cx="255" cy="183" r="7" fill="#2c2c31" stroke="var(--muted)" />
            <circle cx="295" cy="183" r="7" fill="#2c2c31" stroke="var(--muted)" />
            <circle cx="345" cy="183" r="7" fill="#2c2c31" stroke="var(--muted)" />
            <circle cx="385" cy="183" r="7" fill="#2c2c31" stroke="var(--muted)" />
          </g>
          {has('Stovetop') && <Badge x={404} y={172} />}
          <text x="320" y="166" textAnchor="middle" fontSize="11" fill="var(--text-2)">Stovetop</text>
        </g>

        {/* Oven (in the cabinet below the stovetop) */}
        <g className="kp-item" onClick={() => onToggle('Oven')}>
          <Glow x={250} y={206} w={140} h={50} active={has('Oven')} />
          <rect x="240" y="198" width="160" height="66" fill="transparent" />
          <g className="kp-shape">
            <rect x="250" y="206" width="140" height="50" rx="4" fill="#1c1c20" stroke="var(--border)" />
            <rect x="262" y="214" width="116" height="30" rx="3" fill="#0b0c10" stroke="var(--muted)" />
            <rect x="250" y="203" width="140" height="4" fill="var(--muted)" />
            <text x="320" y="234" textAnchor="middle" fontSize="10" fill="var(--text-2)">Oven</text>
          </g>
          {has('Oven') && <Badge x={384} y={210} />}
        </g>

        {/* Blender */}
        <g className="kp-item" onClick={() => onToggle('Blender')}>
          <Glow x={415} y={108} w={60} h={82} active={has('Blender')} />
          <rect x="400" y="92" width="90" height="106" fill="transparent" />
          <g className="kp-shape">
            <path d="M 425 112 L 465 112 L 458 172 L 432 172 Z" fill="rgba(133,131,236,0.28)" stroke="var(--accent)" strokeWidth="1.5" />
            <line x1="429" y1="130" x2="461" y2="130" stroke="var(--accent)" strokeWidth="1" opacity="0.6" />
            <line x1="430" y1="148" x2="460" y2="148" stroke="var(--accent)" strokeWidth="1" opacity="0.6" />
            <rect x="424" y="172" width="42" height="18" rx="3" fill="#2c2c31" stroke="var(--border)" />
          </g>
          {has('Blender') && <Badge x={459} y={108} />}
          <text x="445" y="102" textAnchor="middle" fontSize="11" fill="var(--text-2)">Blender</text>
        </g>

        {/* Toaster */}
        <g className="kp-item" onClick={() => onToggle('Toaster')}>
          <Glow x={490} y={150} w={60} h={40} active={has('Toaster')} />
          <rect x="480" y="134" width="80" height="64" fill="transparent" />
          <g className="kp-shape">
            <rect x="490" y="150" width="60" height="40" rx="6" fill="#3a3a40" stroke="var(--border)" />
            <rect x="500" y="150" width="10" height="8" fill="#111318" />
            <rect x="516" y="150" width="10" height="8" fill="#111318" />
            <rect x="532" y="150" width="10" height="8" fill="#111318" />
            <rect x="484" y="168" width="6" height="14" rx="2" fill="var(--muted)" />
          </g>
          {has('Toaster') && <Badge x={544} y={146} />}
          <text x="520" y="130" textAnchor="middle" fontSize="11" fill="var(--text-2)">Toaster</text>
        </g>

        {/* Kettle */}
        <g className="kp-item" onClick={() => onToggle('Kettle')}>
          <Glow x={568} y={118} w={54} h={72} active={has('Kettle')} />
          <rect x="548" y="100" width="94" height="106" fill="transparent" />
          <g className="kp-shape">
            <path d="M 572 190 L 572 140 Q 572 122 595 122 Q 618 122 618 140 L 618 190 Z" fill="#c9ccd2" stroke="var(--border)" />
            <path d="M 570 150 L 552 140" stroke="#c9ccd2" strokeWidth="6" strokeLinecap="round" />
            <path d="M 618 150 Q 634 150 634 165 Q 634 178 618 178" fill="none" stroke="#c9ccd2" strokeWidth="5" strokeLinecap="round" />
            <circle cx="595" cy="126" r="4" fill="var(--muted)" />
            <rect x="572" y="190" width="46" height="8" fill="#2c2c31" />
          </g>
          {has('Kettle') && <Badge x={614} y={114} />}
          <text x="595" y="110" textAnchor="middle" fontSize="11" fill="var(--text-2)">Kettle</text>
        </g>
      </svg>
    </div>
  );
}
