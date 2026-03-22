/**
 * shareCard.js — Generate a share card image using Canvas API
 * and share/copy results from the EndPage.
 */

const CARD_W = 1200;
const CARD_H = 630;

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawWrappedText(ctx, text, { x, y, maxWidth, lineHeight, maxLines = 3 }) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);

  const visibleLines = lines.slice(0, maxLines).map((line, index) => {
    if (index !== maxLines - 1 || lines.length <= maxLines) return line;
    let trimmed = line;
    while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  });

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return visibleLines.length;
}

/**
 * Render a share card to a canvas and return a Blob (PNG).
 *
 * @param {Object} opts
 * @param {number} opts.score     – correct answers
 * @param {number} opts.total     – total questions
 * @param {string} opts.packName  – pack display name
 * @param {string} opts.topSpecies  – best species name (optional)
 * @param {boolean} opts.isDaily    – daily challenge flag
 * @param {string}  opts.mode       – game mode label
 * @param {string}  opts.summaryLine – main social summary
 * @param {string}  opts.inviteLine  – invitation line
 * @param {string}  opts.ctaLine     – bottom CTA line
 * @returns {Promise<Blob>}
 */
export async function generateShareCard({
  score,
  total,
  packName,
  topSpecies,
  isDaily,
  mode,
  summaryLine,
  inviteLine,
  ctaLine,
  highlightLabel,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  // ── Background gradient ──
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, '#16311d');
  grad.addColorStop(0.55, '#1f472c');
  grad.addColorStop(1, '#6b8f45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Atmospheric decorations ──
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(CARD_W - 60, 40, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90, CARD_H - 40, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(11, 18, 12, 0.22)';
  roundRect(ctx, 42, 42, CARD_W - 84, CARD_H - 84, 30);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, 42, 42, CARD_W - 84, CARD_H - 84, 30);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(isDaily ? 'Defi du jour iNaturaQuizz' : 'iNaturaQuizz', 90, 102);

  // ── Big score ──
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 142px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${score}/${total}`, 86, 258);

  if (packName) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, 90, 288, Math.min(690, ctx.measureText(packName).width + 42), 52, 18);
    ctx.fill();
    ctx.fillStyle = '#eaf7e8';
    ctx.font = '600 26px system-ui, -apple-system, sans-serif';
    ctx.fillText(packName, 110, 323);
  }

  if (mode) {
    const modeText = mode;
    const modeWidth = ctx.measureText(modeText).width + 34;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, 90, 360, modeWidth, 40, 14);
    ctx.fill();
    ctx.fillStyle = '#f6d68a';
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(modeText, 107, 387);
  }

  ctx.fillStyle = '#f4fff2';
  ctx.font = '700 38px system-ui, -apple-system, sans-serif';
  const summaryY = 160;
  const linesUsed = drawWrappedText(ctx, summaryLine, {
    x: 670,
    y: summaryY,
    maxWidth: 420,
    lineHeight: 48,
    maxLines: 3,
  });

  if (topSpecies) {
    const badgeY = summaryY + linesUsed * 48 + 26;
    ctx.fillStyle = 'rgba(246, 214, 138, 0.16)';
    roundRect(ctx, 670, badgeY, 360, 56, 18);
    ctx.fill();
    ctx.fillStyle = '#f6d68a';
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(highlightLabel || 'Espèce marquante', 692, badgeY + 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 600 26px system-ui, -apple-system, sans-serif';
    drawWrappedText(ctx, topSpecies, {
      x: 670,
      y: badgeY + 92,
      maxWidth: 420,
      lineHeight: 34,
      maxLines: 2,
    });
  }

  if (inviteLine) {
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    drawWrappedText(ctx, inviteLine, {
      x: 90,
      y: 470,
      maxWidth: 700,
      lineHeight: 38,
      maxLines: 2,
    });
  }

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, 90, 532, 500, 54, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(ctaLine || 'Voir le récap et jouer', 115, 566);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('inaturaquizz.com', CARD_W - 92, CARD_H - 66);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Build share text for copy / native share.
 */
export function buildShareText({
  url,
  summaryLine,
  inviteLine,
}) {
  let text = summaryLine || "J'ai joué sur iNaturaQuizz.";
  if (inviteLine) text += `\n${inviteLine}`;
  text += `\n${url || 'https://inaturaquizz.com'}`;
  return text;
}

/**
 * Share via Web Share API (with image fallback to text-only).
 */
export async function nativeShare({ title, text, url, blob }) {
  if (!navigator.share) return { status: 'unavailable' };
  try {
    const data = { title, text, url };
    // Try sharing with image if supported
    if (blob && navigator.canShare) {
      const file = new File([blob], 'inaturaquizz-score.png', { type: 'image/png' });
      const fileData = { ...data, files: [file] };
      if (navigator.canShare(fileData)) {
        await navigator.share(fileData);
        return { status: 'shared' };
      }
    }
    await navigator.share(data);
    return { status: 'shared' };
  } catch (err) {
    if (err?.name === 'AbortError') return { status: 'aborted' };
    return { status: 'failed', error: err };
  }
}

/**
 * Copy text to clipboard (with legacy fallback for non-HTTPS contexts).
 */
export async function copyToClipboard(text) {
  // Modern API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through to legacy */ }
  }
  // Legacy fallback (works in more contexts)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
