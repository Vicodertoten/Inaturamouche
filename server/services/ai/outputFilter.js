// server/services/ai/outputFilter.js
// Filtre de sortie v6 — parsing robuste de texte brut + fallback intelligent

import { OUTPUT_CONSTRAINTS, FALLBACK_TIPS, PERSONA } from './aiConfig.js';

// ── Helpers ─────────────────────────────────────────────────────

const countWords = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const collectQualityIssues = (text, { label = 'texte' } = {}) => {
  if (!text) return [];
  const issues = [];
  const trimmed = text.trim();

  // Exemple visé: "boooon", "mammifèree", artefacts de génération.
  if (/\b[\p{L}]*([\p{L}])\1{2,}[\p{L}]*\b/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient des lettres répétées anormales`);
  }

  // Exemple visé: "de de", "avec avec".
  if (/\b(\p{L}{2,})\s+\1\b/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient un mot dupliqué`);
  }

  // Garde-fou simple contre mots "cassés" très longs.
  if (/\b[\p{L}-]{31,}\b/u.test(text)) {
    issues.push(`QUALITY: ${label} contient un mot anormalement long`);
  }

  // Exemple visé: ",,", "!!", "...?".
  if (/[,;:.!?]{2,}/u.test(text)) {
    issues.push(`QUALITY: ${label} contient une ponctuation anormale`);
  }

  // Exemple visé: "Sources : Wikipedia..." (bruit inutile dans la réponse finale).
  if (/\bsource(?:s)?\s*:/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient des métadonnées parasites`);
  }

  // Exemple visé: "🔍" et autres symboles non textuels.
  if (/[^\p{L}\p{N}\s,;:.!?()'"’-]/u.test(text)) {
    issues.push(`QUALITY: ${label} contient des symboles non textuels`);
  }

  // Exemple visé: "uu", "noiie", "plussvariées".
  if (/\b[\p{L}-]*(?:aa|ee|ii|oo|uu|yy|ss[bcdfghjklmnpqrstvwxz]|mm[bcdfghjklmnpqrstvwxz])[\p{L}-]*\b/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient des séquences de lettres suspectes`);
  }

  // Garde-fou pour texte coupé brutalement.
  if (trimmed.length > 8 && !/[.!?]$/.test(trimmed)) {
    const lastToken = trimmed.split(/\s+/).filter(Boolean).pop() || '';
    if (lastToken.length <= 2) {
      issues.push(`QUALITY: ${label} semble tronqué`);
    }
  }

  return issues;
};

const getCommonName = (taxon) =>
  taxon?.preferred_common_name || taxon?.common_name || null;

// ── Normalisation du texte ──────────────────────────────────────

export function normalizeExplanation(text) {
  if (!text) return '';
  let value = text.trim().replace(/\s+/g, ' ');
  value = value.replace(/\b(visible|montr[ée]e?|présent[ée]e?)\s+(sur|dans)\s+(la|l')\s*(premi[eè]re|seconde|deuxi[eè]me)?\s*(image|photo)\b/gi, '');
  value = value.replace(/\b(sur|dans)\s+(la|l')\s*(image|photo)\b/gi, '');
  value = value.replace(/\b(selon|d'apr[eè]s)\s+wikip[ée]dia\b/gi, '');
  return value.replace(/\s{2,}/g, ' ').trim();
}

// ── Parsing de la réponse IA ────────────────────────────────────

/**
 * Parse la réponse de l'IA. v6 : on attend du texte brut avec "---" comme séparateur.
 * On accepte aussi du JSON en fallback (au cas où l'IA en génère quand même).
 */
export function parseAIResponse(text) {
  if (!text) return null;
  const cleanedInput = text
    .replace(/[🔍]/gu, '')
    .replace(/^\s*source(?:s)?\s*:.*$/gimu, '')
    .trim();
  const trimmed = cleanedInput;

  // ── Stratégie 1 : texte brut avec séparateur "---" ──────────
  if (trimmed.includes('---')) {
    const parts = trimmed.split('---').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const explanation = normalizeExplanation(parts[0]);
      const discriminant = parts[1].replace(/^(critère|discriminant|clé)\s*:\s*/i, '').trim();
      if (explanation.length > 15 && discriminant.length > 3) {
        return { explanation, discriminant };
      }
    }
  }

  // ── Stratégie 2 : JSON (fallback si l'IA génère du JSON malgré tout) ──
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.explanation) {
        return {
          explanation: normalizeExplanation(parsed.explanation),
          discriminant: parsed.discriminant ? String(parsed.discriminant).trim() : null,
        };
      }
    } catch (_) { /* fallthrough */ }
  }

  // ── Stratégie 3 : texte brut simple (pas de séparateur) ─────
  const cleaned = normalizeExplanation(trimmed);
  if (cleaned.length > 20) {
    // Essayer d'extraire un discriminant de la dernière phrase
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.length > 5);
    const lastSentence = sentences[sentences.length - 1] || '';
    const mainText = sentences.length > 1 ? sentences.slice(0, -1).join(' ') : cleaned;

    return {
      explanation: mainText || cleaned,
      discriminant: sentences.length > 1 ? lastSentence : null,
    };
  }

  return null;
}

// ── Validation ──────────────────────────────────────────────────

export function validateAndClean(responseObj) {
  const c = OUTPUT_CONSTRAINTS.explanation;
  const issues = [];

  if (!responseObj || typeof responseObj !== 'object') {
    return { valid: false, issues: ['Réponse non-objet'], explanation: null, discriminant: null };
  }

  const explanation = normalizeExplanation(responseObj.explanation);
  const discriminant = responseObj.discriminant
    ? String(responseObj.discriminant).trim()
    : null;

  const wordCount = countWords(explanation);
  if (wordCount < c.minWords) issues.push(`Trop court (${wordCount} mots)`);
  if (wordCount > c.maxWords * 1.5) issues.push(`Trop long (${wordCount} mots)`);
  issues.push(...collectQualityIssues(explanation, { label: 'explication' }));
  if (discriminant) {
    const discriminantWords = countWords(discriminant);
    if (discriminantWords > 18) {
      issues.push(`QUALITY: critère trop long (${discriminantWords} mots)`);
    }
    // Le critère attendu est une formule courte, pas une phrase narrative.
    if (/\b(?:est|sont|a|ont|étais|était|étaient|sera|seront)\b/iu.test(discriminant)) {
      issues.push('QUALITY: critère ressemble à une phrase incomplète');
    }
    issues.push(...collectQualityIssues(discriminant, { label: 'critère' }));
  }

  return {
    valid: issues.length === 0,
    issues,
    explanation: explanation || null,
    discriminant,
  };
}

// ── Fallback intelligent ────────────────────────────────────────

/**
 * Construit un fallback quand l'IA a échoué.
 * v6 : on utilise des conseils pré-écrits par groupe taxonomique.
 * C'est TOUJOURS mieux que d'essayer d'extraire du Wikipedia avec des regex.
 */
export function buildMorphologyFallback(correctTaxon, wrongTaxon, severity, dataCorrect, dataWrong) {
  const tone = PERSONA.toneByContext[severity] || PERSONA.toneByContext.MEDIUM;

  // Identifier le groupe taxonomique
  const group = correctTaxon?.iconic_taxon_name
    || dataCorrect?.taxonomy?.iconic_taxon_name
    || null;

  // Chercher des tips pour ce groupe
  const tips = FALLBACK_TIPS[group] || FALLBACK_TIPS._default;
  // Prendre un tip aléatoire (basé sur les IDs pour être déterministe par paire)
  const tipIndex = ((correctTaxon?.id || 0) + (wrongTaxon?.id || 0)) % tips.length;
  const tip = tips[tipIndex];

  const explanation = `${tone.lead}${tip}`;
  const discriminant = getGroupDiscriminant(group);

  return {
    explanation,
    discriminant,
    sources: [...(dataCorrect?.sources || []), ...(dataWrong?.sources || [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2),
    fallback: true,
  };
}

function getGroupDiscriminant(group) {
  const map = {
    Fungi: 'Lamelles vs tubes, forme du chapeau, anneau',
    Aves: 'Bec, silhouette, barres alaires',
    Insecta: 'Antennes, motifs, forme du corps',
    Plantae: 'Feuilles, fleur, tige',
    Mammalia: 'Taille, oreilles, pelage',
    Reptilia: 'Écailles, motif dorsal, tête',
    Amphibia: 'Peau lisse vs verruqueuse, motifs',
    Arachnida: 'Abdomen, pattes, yeux',
    Mollusca: 'Coquille, stries, ouverture',
    Actinopterygii: 'Corps, nageoires, couleur',
  };
  return map[group] || 'Silhouette, couleurs, milieu de vie';
}

// ── Fallback pour les énigmes ───────────────────────────────────

const getAncestorName = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon.name;
  return Array.isArray(taxon.ancestors)
    ? taxon.ancestors.find((a) => a?.rank === rank)?.name || null
    : null;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripTaxonNames(text, taxon) {
  if (!text) return '';
  const names = [taxon?.name, getCommonName(taxon)].filter(Boolean);
  if (names.length === 0) return text;
  let updated = text;
  names.forEach((name) => {
    const re = new RegExp(`\\b${escapeRegExp(String(name))}\\b`, 'gi');
    updated = updated.replace(re, 'cette espèce');
  });
  return updated;
}

export function buildFallbackRiddleClues(targetTaxon, speciesData) {
  const family = getAncestorName(targetTaxon, 'family');
  const description = speciesData?.description || '';
  const cleanedDesc = stripTaxonNames(description, targetTaxon);

  const sentences = cleanedDesc
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 180);

  const clues = [];

  if (family) {
    clues.push(`Appartient à la famille des ${family}.`);
  } else {
    clues.push(sentences[2] || 'Espèce observable dans des habitats naturels variés.');
  }

  clues.push(sentences[1] || sentences[0] || 'Son apparence est distincte pour un œil averti.');
  clues.push(sentences[0] || 'Un détail visuel permet de la reconnaître immédiatement.');

  return clues.map((c) => {
    let clean = c.replace(/\s+/g, ' ').trim();
    return clean.length > OUTPUT_CONSTRAINTS.riddle.maxClueLength
      ? clean.slice(0, OUTPUT_CONSTRAINTS.riddle.maxClueLength).trim()
      : clean;
  });
}

// ── Parsing des énigmes ─────────────────────────────────────────

export function parseRiddleResponse(text) {
  if (!text) return { clues: [], sources: [] };

  const trimmed = text.trim();

  // JSON
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.clues)) return { clues: parsed.clues, sources: parsed.sources || [] };
    } catch (_) { /* fallthrough */ }
  }

  // Lignes numérotées
  const lines = trimmed
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[\s.):-]+/, '').trim())
    .filter((l) => l.length > 5);

  return { clues: lines.slice(0, 3), sources: [] };
}

export function normalizeRiddleClues(clues, targetTaxon) {
  if (!Array.isArray(clues)) return [];

  return clues
    .map((clue) => {
      if (typeof clue !== 'string') return '';
      let c = clue.trim().replace(/\s+/g, ' ');
      c = c.replace(/^(indice|clue)\s*\d+\s*[:.)-]?\s*/i, '');
      c = c.replace(/^[-*•]\s+/, '');
      c = stripTaxonNames(c, targetTaxon);
      return c.length > OUTPUT_CONSTRAINTS.riddle.maxClueLength
        ? c.slice(0, OUTPUT_CONSTRAINTS.riddle.maxClueLength).trim()
        : c;
    })
    .filter((c) => c.length > 5);
}
