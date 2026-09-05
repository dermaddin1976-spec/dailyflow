// Curated to a short list of well-known Austrian grocery chains that carry
// decent quality fresh/protein staples for someone training seriously —
// no near-duplicate banners (Billa Plus, Eurospar, Interspar), no
// bottom-shelf discounters (Penny), and no defunct/merged brands (Merkur
// was folded into Billa/Billa Plus by REWE Group a few years back).
export const GROCERY_STORE_OPTIONS = ['Billa', 'Spar', 'Hofer', 'Lidl', 'MPreis'];

// Curated to the handful of appliances that actually change what a recipe
// can look like. Niche extras (rice cooker, stand mixer, sous vide, ...)
// are left to the free-text "other" field instead of cluttering the picker.
export const KITCHEN_TOOL_OPTIONS = ['Oven', 'Stovetop', 'Microwave', 'Air fryer', 'Blender', 'Toaster', 'Kettle'];

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
