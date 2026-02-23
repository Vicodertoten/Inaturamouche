// server/services/ai/aiConfig.js
// Configuration centralisée du système IA v6 — robustesse et pertinence

export const MODEL_CONFIG = {
  model: 'gemini-2.5-flash',
  apiUrlTemplate: (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

  generate: {
    // SYSTEME PARFAIT : Structure stricte (Schema) + Créativité (Température)
    temperature: 0.4,
    topP: 0.8,
    maxOutputTokens: 4000,
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        internal_critique: { type: "STRING", description: "ÉTAPE 1 (Invisible) : Critique ton propre brouillon. Vérifie : orthographe, accords, répétitions, et que tu n'as PAS utilisé 'le premier/le second'." },
        intro: { type: "STRING", description: "ÉTAPE 2 : Une interjection courte (ex: 'Oh là !')." },
        explanation: { type: "STRING", description: "ÉTAPE 3 (Finale) : L'explication avec le ton de Papy Mouche. Vivante, variée mais rigoureuse sur les noms." },
        discriminant: { type: "STRING", description: "Le critère clé en une phrase nominale." }
      },
      required: ["internal_critique", "explanation", "discriminant"]
    }
  },

  riddle: {
    temperature: 0.8,
    topP: 0.95,
    maxOutputTokens: 4000,
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        clues: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "3 indices de difficulté décroissante (Difficile -> Moyen -> Facile)"
        }
      },
      required: ["clues"]
    }
  },

  timeoutMs: 45_000,
  maxRetries: 2,
};

export const PERSONA = {
  name: 'Papy Mouche',
  role: "professeur naturaliste passionné d'identification terrain",
  traits: ['bienveillant', 'concis', 'précis', 'vocabulaire simple', 'tutoiement'],
  // Instructions système pour guider le modèle multimodal
  systemInstruction: `Tu es Papy Mouche. Tu corriges une erreur d'identification.
  1. AUTO-CORRECTION : Utilise le champ 'internal_critique' pour vérifier ta grammaire/orthographe et tes faits AVANT de rédiger l'explication finale.
  2. NOMINATION : Cite TOUJOURS les noms complets sans le nom scientifique(ex: "Le Merle noir"). Interdit d'utiliser "le premier", "l'autre".
  3. LANGUE : Orthographe et grammaire doivent être PARFAITES (niveau éditeur littéraire).
  4. FORMAT : JSON strict.`,

  toneByContext: {
    HUGE: {
      description: "taquine gentiment",
      lead: '',
    },
    MEDIUM: {
      description: 'direct et pédagogique',
      lead: '',
    },
    CLOSE: {
      description: 'encourageant',
      lead: '',
    },
  },
};

export const OUTPUT_CONSTRAINTS = {
  explanation: { minWords: 5, maxWords: 200 },
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
  explanation: 'v11-gemini-3-preview',
  riddle: 'v11-gemini-3-preview',
};
