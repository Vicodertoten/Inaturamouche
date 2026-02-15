// client/src/components/PackIcons.jsx
// SVG icons for each pack — replaces emoji for a polished look

const s = { width: '1em', height: '1em', display: 'inline-block', verticalAlign: '-0.1em', fill: 'currentColor', flexShrink: 0 };

/* ── Helper ── */
const I = (children) => <svg viewBox="0 0 24 24" style={s} xmlns="http://www.w3.org/2000/svg">{children}</svg>;

/* ── Pack SVG icons ── */
const icons = {
  // 🍄 Mushroom
  european_mushrooms: () => I(
    <path d="M12 2C6.5 2 2 5.6 2 10c0 1 .3 1.9.7 2.6.5.8 1.4 1.4 2.3 1.4h2l-1 6c-.2 1 .5 2 1.5 2h9c1 0 1.7-1 1.5-2l-1-6h2c.9 0 1.8-.6 2.3-1.4.4-.7.7-1.6.7-2.6 0-4.4-4.5-8-10-8z" />
  ),
  belgium_mushrooms: () => I(
    <path d="M12 2C6.5 2 2 5.6 2 10c0 1 .3 1.9.7 2.6.5.8 1.4 1.4 2.3 1.4h2l-1 6c-.2 1 .5 2 1.5 2h9c1 0 1.7-1 1.5-2l-1-6h2c.9 0 1.8-.6 2.3-1.4.4-.7.7-1.6.7-2.6 0-4.4-4.5-8-10-8z" />
  ),

  // 🌳 Tree
  european_trees: () => I(
    <path d="M12 2L5 10h3l-3 5h3l-3 5h14l-3-5h3l-3-5h3L12 2zM11 17h2v5h-2z" />
  ),
  belgium_trees: () => I(
    <path d="M12 2l-5 6h2.5L6 14h3l-3 5h12l-3-5h3l-3.5-6H17L12 2zM11 19h2v3h-2z" />
  ),

  // 🐦 Bird
  world_birds: () => I(
    <path d="M22 3l-1.5 1.5L18 3l-1 4-4 1-3-3v3l-4 5c-1 1.3-.7 3 .5 4l3 2.5L7 22h3l3-3 4 1c1.7 0 3-1.3 3-3v-5l1-4-1-3 2-1.5V3z" />
  ),
  belgium_birds: () => I(
    <path d="M22 3l-1.5 1.5L18 3l-1 4-4 1-3-3v3l-4 5c-1 1.3-.7 3 .5 4l3 2.5L7 22h3l3-3 4 1c1.7 0 3-1.3 3-3v-5l1-4-1-3 2-1.5V3z" />
  ),

  // 🦊 Fox / Mammal
  france_mammals: () => I(
    <path d="M12 3C8 3 4 6 4 10c0 2 1 3.5 2.5 4.5L5 20c-.2.6.2 1.2.8 1.2h2.5l1-2.5c.8.2 1.7.3 2.7.3s1.9-.1 2.7-.3l1 2.5h2.5c.6 0 1-.6.8-1.2l-1.5-5.5C19 13.5 20 12 20 10c0-4-4-7-8-7zm-3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  ),
  belgium_mammals: () => I(
    <path d="M12 3C8 3 4 6 4 10c0 2 1 3.5 2.5 4.5L5 20c-.2.6.2 1.2.8 1.2h2.5l1-2.5c.8.2 1.7.3 2.7.3s1.9-.1 2.7-.3l1 2.5h2.5c.6 0 1-.6.8-1.2l-1.5-5.5C19 13.5 20 12 20 10c0-4-4-7-8-7zm-3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  ),

  // 🦎 Herps (lizard/amphibian)
  belgium_herps: () => I(
    <path d="M19 4c-1 0-2.5.5-3.5 1.5L14 7l-2.5-1C10 5.5 8.5 6 7.5 7L4 11l2 1 2-2 1 2-3 5 2 1 2.5-4L12 15l1 4h2l-1-5 3-3 2 1 2-2-2-3V4z" />
  ),

  // 🦋 Butterfly
  amazing_insects: () => I(
    <path d="M12 4c-1 0-2 2-2 4l-5-2c-1.5-.5-3 .5-3 2 0 3 2 5.5 5 6l-1 3c-.3 1 .4 2 1.3 2H12m0-15c1 0 2 2 2 4l5-2c1.5-.5 3 .5 3 2 0 3-2 5.5-5 6l1 3c.3 1-.4 2-1.3 2H12m0-15v15" />
  ),
  belgium_butterflies: () => I(
    <path d="M12 4c-1 0-2 2-2 4l-5-2c-1.5-.5-3 .5-3 2 0 3 2 5.5 5 6l-1 3c-.3 1 .4 2 1.3 2H12m0-15c1 0 2 2 2 4l5-2c1.5-.5 3 .5 3 2 0 3-2 5.5-5 6l1 3c.3 1-.4 2-1.3 2H12m0-15v15" />
  ),

  // 🌿 Flora
  mediterranean_flora: () => I(
    <path d="M12 22V8m0 0c0-4 4-6 8-6-1 4-4 6-8 6zm0 0c0-4-4-6-8-6 1 4 4 6 8 6zm-3 6c0-2 1.5-3.5 3-4 1.5.5 3 2 3 4" />
  ),

  // 🌼 Wildflower
  belgium_wildflowers: () => I(
    <><circle cx="12" cy="12" r="3" /><path d="M12 2a3 3 0 00-1 5.8V12m1-10a3 3 0 011 5.8V12m7.7-5a3 3 0 01-4.5 3.4L12 12m5.2-1.6a3 3 0 01-4.5 3.4L12 12m2.2 8.6a3 3 0 01-1-5.8L12 12m-2.2 8.6a3 3 0 001-5.8L12 12m-7.7-5a3 3 0 014.5 3.4L12 12m-5.2-1.6a3 3 0 014.5 3.4L12 12" stroke="currentColor" strokeWidth="1.5" fill="none" /></>
  ),

  // 🪰 Dragonfly
  belgium_dragonflies: () => I(
    <path d="M12 4v16M12 4c-1.5 1-4 3-7 3 3 1 5.5 2 7 3m0-6c1.5 1 4 3 7 3-3 1-5.5 2-7 3m-4 3c1.5-.5 3-1 4-2m4 2c-1.5-.5-3-1-4-2m0 0v4" />
  ),

  // 🕷️ Spider
  belgium_spiders: () => I(
    <><circle cx="12" cy="11" r="3" /><circle cx="12" cy="7" r="2" /><path d="M9 9L4 5m6 5L4 12m5 2l-5 4m10-12l5-4m-6 5l6 2m-5 4l5 4" stroke="currentColor" strokeWidth="1.5" fill="none" /></>
  ),

  // 🐟 Fish
  belgium_fish: () => I(
    <path d="M18 12c0 0 3-3 4-3s-1 3-1 3 2 3 1 3-4-3-4-3zm0 0c-2 3-6 5-10 5-3 0-5-2-6-5 1-3 3-5 6-5 4 0 8 2 10 5zm-10 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  ),

  // 🪲 Beetle
  belgium_beetles: () => I(
    <path d="M12 6a5 5 0 00-5 5v5c0 2.8 2.2 5 5 5s5-2.2 5-5v-5a5 5 0 00-5-5zm0 0V3m0 3c-2 0-3.5-.5-5-2m5 2c2 0 3.5-.5 5-2m-10 7H4m3 5H4m16-5h-3m0 5h3M12 9v10m-3-5h6" stroke="currentColor" strokeWidth="1.5" fill="none" />
  ),

  // 🪴 Moss & Lichen
  belgium_mosses_lichens: () => I(
    <path d="M12 22v-8m0 0c-2-1-5-4-5-7a5 5 0 0110 0c0 3-3 6-5 7zm-3-3c-2 1-4 .5-5-1m11 1c2 1 4 .5 5-1M9 6c-1-2-3-2.5-4-2m10 2c1-2 3-2.5 4-2" />
  ),

  // 🐌 Mollusk
  belgium_mollusks: () => I(
    <path d="M3 18c1 0 2-1 3-1s2.5 1 4 1c2 0 3.5-2 3.5-4.5C13.5 10 11 8 8.5 8S4 10 4 13m4.5-5c0-2 1.5-4 4-4s4.5 2 4.5 5-2 5.5-4.5 5.5M6 18c-.5.5-1.5 1.5-3 2m14-6c1.5 0 3-1 4-2" />
  ),

  // 🌱 Edible plants
  belgium_edible_plants: () => I(
    <path d="M12 22v-7m0 0c0-4-5-7-9-7 0 5 4 7 9 7zm0 0c0-4 5-7 9-7 0 5-4 7-9 7zM7 3c0 3 2.5 5 5 5m5-5c0 3-2.5 5-5 5m0 0v4" />
  ),

  // 🎒 Custom / fallback
  custom: () => I(
    <path d="M9 3a3 3 0 016 0m-8 4h10a2 2 0 012 2v10a3 3 0 01-3 3H8a3 3 0 01-3-3V9a2 2 0 012-2zm1 4v6m6-6v6" />
  ),
};

/**
 * Render a pack icon as inline SVG.
 * @param {string} packId
 * @param {object} [props] — extra props passed to wrapper span
 * @returns {JSX.Element}
 */
export function PackIcon({ packId, className, style }) {
  const render = icons[packId] || icons.custom;
  return <span className={className} style={style}>{render()}</span>;
}

export default PackIcon;
