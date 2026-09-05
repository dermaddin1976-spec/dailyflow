export const GROCERY_STORE_OPTIONS = [
  'Billa', 'Billa Plus', 'Spar', 'Interspar', 'Eurospar', 'Hofer',
  'Lidl', 'Penny', 'MPreis', 'Adeg', 'Merkur', 'Unimarkt',
];

export const KITCHEN_TOOL_OPTIONS = [
  'Oven', 'Stovetop', 'Microwave', 'Air fryer', 'Blender', 'Food processor',
  'Slow cooker', 'Instant Pot / pressure cooker', 'Rice cooker', 'Toaster',
  'Grill / BBQ', 'Stand mixer', 'Kettle',
];

export function toList(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

export function splitKnownOther(str, knownOptions) {
  const items = toList(str);
  return {
    known: items.filter(i => knownOptions.includes(i)),
    other: items.filter(i => !knownOptions.includes(i)).join(', '),
  };
}

export function joinKnownOther(known, other) {
  return [...(known || []), ...toList(other)].join(', ');
}
