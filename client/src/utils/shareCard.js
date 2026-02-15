/**
 * shareCard.js — Generate a share card image using Canvas API
 * and share/copy results from the EndPage.
 */

const CARD_W = 600;
const CARD_H = 340;

/**
 * Render a share card to a canvas and return a Blob (PNG).
 *
 * @param {Object} opts
 * @param {number} opts.score     – correct answers
 * @param {number} opts.total     – total questions
 * @param {string} opts.packName  – pack display name
 * @param {string} opts.topSpecies – best species name (optional)
 * @param {boolean} opts.isDaily  – daily challenge flag
 * @param {string}  opts.mode     – game mode label
 * @returns {Promise<Blob>}
 */
export async function generateShareCard({ score, total, packName, topSpecies, isDaily, mode }) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  // ── Background gradient ──
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, '#1a2e1a');
  grad.addColorStop(1, '#2d1f0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Subtle corner decoration ──
  ctx.fillStyle = 'rgba(221,161,94,0.08)';
  ctx.beginPath();
  ctx.arc(CARD_W, 0, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, CARD_H, 140, 0, Math.PI * 2);
  ctx.fill();

  // ── Border ──
  ctx.strokeStyle = 'rgba(221,161,94,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, CARD_W - 20, CARD_H - 20);

  // ── Title ──
  ctx.fillStyle = '#dda15e';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const title = isDaily ? '📅 Défi du Jour — iNaturaQuizz' : '🍄 iNaturaQuizz';
  ctx.fillText(title, CARD_W / 2, 55);

  // ── Big score ──
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${score}/${total}`, CARD_W / 2, 140);

  // ── Pack name ──
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  const packLine = packName || '';
  ctx.fillText(packLine, CARD_W / 2, 175);

  // ── Mode badge ──
  if (mode) {
    ctx.fillStyle = 'rgba(221,161,94,0.25)';
    const modeText = mode;
    const modeMetrics = ctx.measureText(modeText);
    const modeW = modeMetrics.width + 24;
    ctx.fillRect(CARD_W / 2 - modeW / 2, 190, modeW, 26);
    ctx.fillStyle = '#dda15e';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillText(modeText, CARD_W / 2, 208);
  }

  // ── Top species ──
  if (topSpecies) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'italic 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`⭐ ${topSpecies}`, CARD_W / 2, 250);
  }

  // ── Footer ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('inaturaquizz.com', CARD_W / 2, CARD_H - 25);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Build share text for copy / native share.
 */
export function buildShareText({ score, total, packName, topSpecies, isDaily, mode }) {
  const emoji = isDaily ? '📅' : '🍄';
  const header = isDaily
    ? `${emoji} Défi du Jour iNaturaQuizz`
    : `${emoji} iNaturaQuizz`;
  let text = `${header}\n${score}/${total}`;
  if (packName) text += ` — ${packName}`;
  if (mode) text += ` (${mode})`;
  if (topSpecies) text += `\n⭐ ${topSpecies}`;
  text += '\nhttps://inaturaquizz.com';
  return text;
}

/**
 * Share via Web Share API (with image fallback to text-only).
 */
export async function nativeShare({ text, blob }) {
  if (!navigator.share) return false;
  try {
    const data = { text };
    // Try sharing with image if supported
    if (blob && navigator.canShare) {
      const file = new File([blob], 'inaturaquizz-score.png', { type: 'image/png' });
      const fileData = { ...data, files: [file] };
      if (navigator.canShare(fileData)) {
        await navigator.share(fileData);
        return true;
      }
    }
    await navigator.share(data);
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return true; // User cancelled — fine
    return false;
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
