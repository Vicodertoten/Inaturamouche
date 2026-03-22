// server/services/ai/aiConfig.js
// Configuration centralisée du système IA v7 — explications brèves + détaillées.

export const MODEL_CONFIG = {
  apiUrlTemplate: (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

  explanation: {
    brief: {
      model: 'gemini-2.5-flash-lite',
      timeoutMs: 2_200,
      maxRetries: 1,
      pricePerMillion: { input: 0.1, output: 0.4 },
      generate: {
        temperature: 0.15,
        topP: 0.8,
        maxOutputTokens: 180,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            key_difference: { type: 'STRING', description: 'Différence visuelle ou structurelle principale.' },
            why_tempting: { type: 'STRING', description: "Pourquoi l'erreur semble logique au premier regard." },
            next_look_for: { type: 'STRING', description: 'Le détail concret à vérifier la prochaine fois.' },
          },
          required: ['key_difference', 'why_tempting', 'next_look_for'],
        },
      },
    },
    full: {
      model: 'gemini-2.5-flash',
      timeoutMs: 5_000,
      maxRetries: 1,
      pricePerMillion: { input: 0.3, output: 2.5 },
      generate: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            explanation: { type: 'STRING', description: 'Explication pédagogique synthétique.' },
            visual_clue: { type: 'STRING', description: 'Indice visuel observable immédiatement.' },
            taxonomic_rule: { type: 'STRING', description: 'Règle de tri taxonomique courte et actionnable.' },
            why_this_confusion_happens: {
              type: 'STRING',
              description: 'Pourquoi cette confusion précise est plausible et comment la corriger.',
            },
            discriminant: { type: 'STRING', description: 'Le repère-clé sous forme nominale.' },
          },
          required: [
            'explanation',
            'visual_clue',
            'taxonomic_rule',
            'why_this_confusion_happens',
            'discriminant',
          ],
        },
      },
    },
    repair: {
      model: 'gemini-2.5-flash-lite',
      timeoutMs: 1_500,
      maxRetries: 1,
      pricePerMillion: { input: 0.1, output: 0.4 },
    },
  },

  riddle: {
    model: 'gemini-2.5-flash',
    timeoutMs: 45_000,
    maxRetries: 2,
    pricePerMillion: { input: 0.3, output: 2.5 },
    generate: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          clues: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: '3 indices de difficulté décroissante (Difficile -> Moyen -> Facile)',
          },
        },
        required: ['clues'],
      },
    },
  },
};

export const PERSONA = {
  name: 'Coach naturaliste',
  role: "mentor de terrain qui aide a distinguer deux especes apres une confusion",
  traits: ['bienveillant', 'concret', 'precis', 'sobre', 'non infantilisant'],
  systemInstruction:
    "Tu es un coach naturaliste. Tu aides a voir le bon repere sans inventer d'information. Tu cites toujours les deux especes explicitement et tu restes court, clair et pedagogique.",
  toneByContext: {
    HUGE: {
      description: 'calme et recentre sur un repere tres concret',
      lead: '',
    },
    MEDIUM: {
      description: 'direct et pedagogique',
      lead: '',
    },
    CLOSE: {
      description: 'encourageant et precis',
      lead: '',
    },
  },
};

export const OUTPUT_CONSTRAINTS = {
  explanation: { minWords: 5, maxWords: 200 },
  brief: {
    keyDifference: { minWords: 2, maxWords: 16 },
    whyTempting: { minWords: 3, maxWords: 24 },
    nextLookFor: { minWords: 3, maxWords: 18 },
    displayText: { minWords: 12, maxWords: 70 },
  },
  full: {
    explanation: { minWords: 8, maxWords: 90 },
    visualClue: { minWords: 4, maxWords: 24 },
    taxonomicRule: { minWords: 4, maxWords: 22 },
    whyThisConfusionHappens: { minWords: 5, maxWords: 28 },
    discriminant: { minWords: 2, maxWords: 12 },
  },
  riddle: { clueCount: 3, maxClueLength: 180 },
};

export const EXPLANATION_CACHE_POLICIES = {
  brief: {
    success: { ttl: 1000 * 60 * 60 * 24 * 7, staleTtl: 1000 * 60 * 60 * 24 * 30 },
    model_guided: { ttl: 1000 * 60 * 60 * 24 * 3, staleTtl: 1000 * 60 * 60 * 24 * 7 },
    limited: { ttl: 1000 * 60 * 30, staleTtl: 1000 * 60 * 60 * 2 },
    fallback: { ttl: 1000 * 60 * 5, staleTtl: 0 },
  },
  full: {
    success: { ttl: 1000 * 60 * 60 * 24 * 14, staleTtl: 1000 * 60 * 60 * 24 * 30 },
    model_guided: { ttl: 1000 * 60 * 60 * 24 * 5, staleTtl: 1000 * 60 * 60 * 24 * 14 },
    limited: { ttl: 1000 * 60 * 60, staleTtl: 1000 * 60 * 60 * 4 },
    fallback: { ttl: 1000 * 60 * 10, staleTtl: 0 },
  },
};

export const FALLBACK_TIPS = {
  Fungi: [
    "Regarde bien le dessous du chapeau : lamelles, tubes ou aiguillons ? Et le pied : lisse, strié, avec un anneau ? Ces détails séparent beaucoup d'espèces proches.",
    "La forme du chapeau (convexe, plat, en entonnoir), la couleur et la texture du pied, et surtout le dessous : lamelles ou tubes ? C'est souvent le détail décisif.",
    "La couleur peut varier, mais le type de dessous (lamelles vs tubes), la présence d'un anneau et l'habitat (sous quels arbres ?) sont plus fiables.",
  ],
  Aves: [
    "Compare le bec (fin, conique, crochu ?), la silhouette en vol, les barres alaires et la queue. Un détail suffit souvent.",
    "La posture, le vol (battu, plané, ondulé), les marques faciales et le bec sont souvent plus utiles que la couleur générale.",
  ],
  Insecta: [
    "Observe les antennes (massue, filiformes, pectinées ?), le nombre de points ou de bandes, et la forme du corps. Souvent un seul détail suffit.",
    "La nervation des ailes, les antennes et les dessins sur le thorax sont de bons critères.",
  ],
  Plantae: [
    "Regarde la forme des feuilles (dentées, lobées, entières ?), leur disposition (alternes, opposées) et la fleur (nombre de pétales, symétrie).",
    "Le bord de la feuille (lisse ou denté ?), la tige (carrée ou ronde ?) et la fleur (pétales soudés ou libres ?) sont des critères fiables.",
  ],
  Mammalia: [
    "Compare la taille, la forme des oreilles, du museau et le pelage. La queue est aussi un bon indice.",
  ],
  Reptilia: [
    "Regarde les écailles (lisses ou carénées), le motif dorsal, la forme de la tête et la taille.",
  ],
  Amphibia: [
    "Compare la texture de la peau (lisse vs verruqueuse), les motifs dorsaux et la couleur du ventre.",
  ],
  Arachnida: [
    "Regarde la forme de l'abdomen, les motifs, les pattes et la disposition des yeux.",
  ],
  Mollusca: [
    "Compare la forme de la coquille, les stries, la couleur et l'ouverture.",
  ],
  Actinopterygii: [
    "Compare la forme du corps, les nageoires, les motifs de couleur et la taille relative.",
  ],
  _default: [
    "Compare bien la silhouette, les couleurs, les motifs et le milieu de vie. Ces critères font souvent toute la différence sur le terrain !",
    "Concentre-toi sur un seul critère à la fois : la forme, puis la couleur, puis la texture. Ça aide quand deux espèces se ressemblent.",
    "Regarde les détails de forme, de couleur et de texture. Même entre espèces proches, il y a toujours un détail qui les distingue.",
  ],
};

export const DATA_SOURCES = {
  wikipedia: {
    enabled: true,
    apiUrl: (lang, title) =>
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    maxSummaryLength: 1200,
    timeoutMs: 5_000,
  },
  inaturalist: {
    enabled: true,
    maxDescLength: 600,
  },
  gbif: {
    enabled: true,
    apiUrl: (scientificName) =>
      `https://api.gbif.org/v1/species/match?verbose=true&name=${encodeURIComponent(scientificName)}`,
    timeoutMs: 5_000,
  },
  catalogueOfLife: {
    enabled: true,
    searchUrl: (scientificName) =>
      `https://www.catalogueoflife.org/data/search?name=${encodeURIComponent(scientificName)}`,
  },
};

export const CACHE_VERSIONS = {
  taxonEvidence: 'v2-evidence-bundle',
  taxonomySupport: 'v2-taxonomy-support',
  briefExplanation: 'v2-brief-gemini-flash-lite',
  fullExplanation: 'v3-full-gemini-flash-narrow-scope',
  riddle: 'v11-gemini-3-preview',
};
