const ICONS = {
  run: (
    <>
      <circle cx="14.2" cy="4.6" r="1.7" />
      <path d="M9 21l2.2-4.6-2-1.8 1-4 3 2.6 3.4 1.2M11.2 16.4L8.4 14M16.6 8.2l-4.4 1.6-1.4 3.2" />
    </>
  ),
  ride: (
    <>
      <circle cx="6" cy="17" r="3.4" />
      <circle cx="18" cy="17" r="3.4" />
      <path d="M6 17l3.5-7h4l2.5 4h2M9.5 10l2-3h3" />
    </>
  ),
  swim: (
    <>
      <path d="M3 17.5c1.4 1.2 2.8 1.2 4.2 0s2.8-1.2 4.2 0 2.8 1.2 4.2 0 2.8-1.2 4.2 0" />
      <path d="M3 13.5c1.4 1.2 2.8 1.2 4.2 0s2.8-1.2 4.2 0 2.8 1.2 4.2 0 2.8-1.2 4.2 0" />
      <circle cx="16.5" cy="6.4" r="1.6" />
      <path d="M6 9.6l4.6-1.6 2.2 2.4 3.2-1" />
    </>
  ),
  hike: (
    <>
      <path d="M4 19l6-13 2.6 5.4L15 6l5 13" />
      <path d="M10.2 12.6l2.3 1.4-1.6 5" />
      <circle cx="15" cy="4" r="1.5" />
    </>
  ),
  strength: (
    <>
      <path d="M6 12h12" />
      <rect x="3" y="9.5" width="3" height="5" rx="1" />
      <rect x="18" y="9.5" width="3" height="5" rx="1" />
      <rect x="7.2" y="8" width="2.2" height="8" rx="1" />
      <rect x="14.6" y="8" width="2.2" height="8" rx="1" />
    </>
  ),
  hiit: <path d="M13 2 4.5 13.5H11l-1.4 8.5L19 10h-6.6L13 2z" strokeLinejoin="round" />,
  yoga: (
    <>
      <circle cx="12" cy="5" r="1.6" />
      <path d="M12 8v4.4M12 12.4l-5.4 6M12 12.4l5.4 6M7.5 12.2L12 9.2l4.5 3" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6v16.8M4.6 8.2h14.8M4.6 15.8h14.8" />
    </>
  ),
  racquet: (
    <>
      <ellipse cx="11" cy="7.5" rx="5.4" ry="6.2" />
      <path d="M11 1.6v11.8M6 6.2h10M5.5 9.6h11" />
      <path d="M9.2 15.6l-1 6.4" />
    </>
  ),
  walk: (
    <>
      <path d="M8.4 3c-1.3 0-2 1-2 2.2 0 1.5 1 2 1 3.4 0 1-.6 1.4-.6 2.4 0 1 .8 1.6 1.8 1.6s1.8-.9 1.8-2.4c0-1.6-.8-2-.8-3.6 0-1.1.5-1.4.5-2.2C10.1 3.6 9.5 3 8.4 3z" />
      <path d="M15.6 9.6c-1.3 0-2 1-2 2.2 0 1.5 1 2 1 3.4 0 1-.6 1.4-.6 2.4 0 1 .8 1.6 1.8 1.6s1.8-.9 1.8-2.4c0-1.6-.8-2-.8-3.6 0-1.1.5-1.4.5-2.2 0-.8-.6-1.4-1.7-1.4z" />
    </>
  ),
  other: <circle cx="12" cy="12" r="7.2" />,
};

const MATCHERS = [
  [/half.?marathon|marathon|\brun\b|running|jog|trail/i, 'run'],
  [/ride|cycl|bik/i, 'ride'],
  [/swim/i, 'swim'],
  [/hik/i, 'hike'],
  [/walk/i, 'walk'],
  [/strength|weight|gym|lift/i, 'strength'],
  [/hiit|crossfit|interval/i, 'hiit'],
  [/yoga|pilates|stretch/i, 'yoga'],
  [/football|soccer|basketball/i, 'ball'],
  [/tennis|badminton|squash/i, 'racquet'],
];

export function activityIconKey(type) {
  if (!type) return 'other';
  for (const [re, key] of MATCHERS) {
    if (re.test(type)) return key;
  }
  return 'other';
}

export default function ActivityIcon({ type, size = 18, style }) {
  const key = activityIconKey(type);
  const body = ICONS[key] || ICONS.other;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
