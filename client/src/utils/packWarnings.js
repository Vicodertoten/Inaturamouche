const WARNING_TAGS = new Set(['edible', 'toxic', 'medicinal', 'lookalike']);

export function hasEducationalWarning(pack) {
  if (!pack || !Array.isArray(pack.tags)) return false;

  for (const rawTag of pack.tags) {
    const tag = String(rawTag || '').trim().toLowerCase();
    if (WARNING_TAGS.has(tag)) return true;
  }

  return false;
}

export function getPackEducationalWarningKey(pack) {
  return hasEducationalWarning(pack) ? 'packs.educational_warning' : null;
}
