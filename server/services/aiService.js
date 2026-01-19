// server/services/aiService.js
import { config } from '../config/index.js';

const { aiApiKey } = config;
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiApiKey}`;

const SYSTEM_PROMPT = `
RÔLE : Tu es "Professeur Mouche", un guide naturaliste passionné et encourageant.
MISSION : Aider un joueur à différencier deux espèces après une erreur, de manière positive et mémorable.

TON & STYLE :
1. Commence IMMÉDIATEMENT le texte de l'explication, sans aucun préfixe, numéro, puce, ou caractère superflu. NE DIS PAS que le joueur a fait une erreur (ex: "Votre réponse est incorrecte").
2. Adopte un ton complice et bienveillant, comme si tu partageais un secret de la nature.
3. Sois très concis et impactant (3 phrases GRAND MAXIMUM).
4. Mets en avant LE critère le plus simple pour ne plus jamais les confondre.
5. EXTRÊMEMENT IMPORTANT : Utilise une grammaire et une orthographe ABSOLUMENT irréprochables en français. Relis-toi attentivement.

EXEMPLE DE CE QU'IL NE FAUT PAS FAIRE :
- "Incorrect, ce n'était pas X mais Y."
- "Votre identification de X est fausse."

EXEMPLE DE TON IDÉAL :
- "La distinction principale est simple : le Pic maculé possède une longue bande blanche sur l'aile, alors que le Pic épeiche a de larges taches blanches sur les épaules."

FORMAT DE SORTIE :
Produis UNIQUEMENT le texte de l'explication, sans aucune fioriture. Pas de markdown, pas d'emojis, pas de salutations superflues, aucun caractère additionnel au début ou à la fin, et SURTOUT aucune faute d'orthographe ou de grammaire.
`;

/**
 * Generates a custom educational explanation using the Gemini API.
 *
 * @param {object} correctTaxon - The full taxon object for the correct answer.
 * @param {object} wrongTaxon - The full taxon object for the user's incorrect answer.
 * @param {string} locale - The locale for the response language (e.g., 'fr', 'en').
 * @param {pino.Logger} logger - The logger instance.
 * @returns {Promise<string>} The AI-generated explanation.
 */
export async function generateCustomExplanation(correctTaxon, wrongTaxon, locale = 'fr', logger) {
  if (!aiApiKey) {
    logger?.warn('AI_API_KEY is not configured. Skipping AI explanation.');
    return 'Le Professeur Mouche est en pause café, explication indisponible !';
  }

  if (!correctTaxon || !wrongTaxon) {
    throw new Error('Correct and wrong taxon details are required.');
  }

  const isSameGenus = correctTaxon.ancestors.some(a => a.rank === 'genus' && wrongTaxon.ancestors.some(wa => wa.id === a.id));
  const isSameFamily = correctTaxon.ancestors.some(a => a.rank === 'family' && wrongTaxon.ancestors.some(wa => wa.id === a.id));
  
  const context = `
[DONNÉES DU JEU]
- Langue demandée : ${locale}
- Espèce Correcte : ${correctTaxon.preferred_common_name} (${correctTaxon.name})
- Classification Correcte : ${correctTaxon.ancestors.map(a => a.name).join(' > ')}

- Erreur du Joueur : ${wrongTaxon.preferred_common_name} (${wrongTaxon.name})
- Classification Erreur : ${wrongTaxon.ancestors.map(a => a.name).join(' > ')}

- Niveau de difficulté de l'erreur : ${isSameGenus ? 'TRÈS PROCHE (Même Genre)' : isSameFamily ? 'MOYEN (Même Famille)' : 'ÉLOIGNÉ'}
`;

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${context}`;

  const requestBody = {
    contents: [{
      parts: [{ text: fullPrompt }],
    }],
    generationConfig: {
      temperature: 0.7,
      topP: 1.0,
      maxOutputTokens: 1500,
    },
  };

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10-second timeout
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger?.error({ status: response.status, body: errorBody }, 'Gemini API request failed');
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    let explanation = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!explanation) {
      logger?.warn({ apiResponse: data }, 'Gemini API returned an empty explanation.');
      throw new Error('Empty explanation from AI.');
    }
    


    return explanation;

  } catch (error) {
    logger?.error({ error: error.message }, 'Failed to generate explanation from Gemini API.');
    // Return a user-friendly error message
    return "Le Professeur Mouche a un trou de mémoire, il ne peut pas fournir d'explication pour le moment.";
  }
}
