// server/services/ai/aiConfig.js
// Configuration centralisée du système IA v6 — robustesse et pertinence

export const MODEL_CONFIG = {
  model: 'gemini-2.5-flash',
  apiUrlTemplate: (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

  generate: {
    // Plus déterministe pour limiter fautes/artefacts, plus court pour réduire latence/tokens.
    temperature: 0.2,
    topP: 0.8,
    maxOutputTokens: 640,
  },

  riddle: {
    temperature: 0.6,
    topP: 0.9,
    maxOutputTokens: 800,
  },

  timeoutMs: 25_000,
  maxRetries: 2,
};

export const PERSONA = {
  name: 'Papy Mouche',
  role: "professeur naturaliste passionné d'identification terrain",
  traits: ['bienveillant', 'concis', 'précis', 'vocabulaire simple', 'tutoiement'],

  toneByContext: {
    HUGE: {
      description: "taquine gentiment",
      lead: 'Oh là ! ',
    },
    MEDIUM: {
      description: 'direct et pédagogique',
      lead: '',
    },
    CLOSE: {
      description: 'encourageant',
      lead: 'Bien vu, tu étais proche ! ',
    },
  },
};

export const OUTPUT_CONSTRAINTS = {
  explanation: { minWords: 15, maxWords: 170 },
  riddle: { clueCount: 3, maxClueLength: 180 },
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
};

export const CACHE_VERSIONS = {
  explanation: 'v6-robust',
  riddle: 'v6-robust',
};
