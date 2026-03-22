import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './RoundSummaryModal.css';
import { BottomSheet } from '../shared/ui';
import { getQuestionThumbnail, getSizedImageUrl } from '../utils/imageUtils';
import { toSafeHttpUrl } from '../utils/mediaUtils';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import { useGameData } from '../context/GameContext.jsx';
import { fetchExplanation, getTaxonDetails } from '../services/api';
import { trackMetric } from '../services/metrics';

const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;
const runtimeEnv = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const FULL_EXPLANATION_ENABLED = runtimeEnv.VITE_AI_EXPLANATION_FULL_ENABLED !== 'false';

const getObservationImageUrl = (taxon) => {
  if (!taxon) return null;
  return (
    taxon.default_photo?.medium_url ||
    taxon.default_photo?.square_url ||
    taxon.default_photo?.url ||
    null
  );
};

const trimText = (value) => (typeof value === 'string' ? value.trim() : '');
const SOURCE_PROVIDER_LABELS = {
  round_photo: 'Photo du round',
  inaturalist: 'iNaturalist',
  wikimedia: 'Wikimedia / Wikipedia',
  col: 'Catalogue of Life',
  gbif: 'GBIF',
  legacy: 'Legacy',
  unknown: 'Source',
};

const normalizeAiSources = (sources = []) => {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source, index) => {
      if (typeof source === 'string') {
        return {
          id: `legacy-${index + 1}`,
          provider: 'legacy',
          kind: 'description',
          label: source,
          url: null,
          lang: 'unknown',
          license: null,
          snippet: '',
        };
      }
      if (!source || typeof source !== 'object') return null;
      return {
        id: source.id || `source-${index + 1}`,
        provider: source.provider || 'unknown',
        kind: source.kind || 'description',
        label: source.label || source.provider || `Source ${index + 1}`,
        url: source.url || null,
        lang: source.lang || 'unknown',
        license: source.license || null,
        snippet: source.snippet || '',
      };
    })
    .filter(Boolean);
};

const buildFallbackBrief = ({ language, correctName }) => ({
  keyDifference:
    language === 'en'
      ? 'Focus on one stable field mark.'
      : language === 'nl'
        ? 'Let op een stabiel veldkenmerk.'
        : 'Regarde un repere stable en premier.',
  whyTempting:
    language === 'en'
      ? 'the overall look can be misleading at first glance'
      : language === 'nl'
        ? 'het algemene uiterlijk kan op het eerste gezicht misleiden'
        : "l'aspect general peut tromper au premier regard",
  nextLookFor:
    language === 'en'
      ? `one clear structural trait on ${correctName || 'the correct species'}`
      : language === 'nl'
        ? `een duidelijk structureel kenmerk van ${correctName || 'de juiste soort'}`
        : `un caractere structurel net chez ${correctName || 'la bonne espece'}`,
  displayText:
    language === 'en'
      ? 'The quick hint is not available right now. Focus on the overall shape and one stable structural clue.'
      : language === 'nl'
        ? 'De korte hint is nu niet beschikbaar. Let vooral op het algemene silhouet en een stabiel structureel kenmerk.'
        : "Le repere rapide n'est pas disponible pour le moment. Regarde surtout la silhouette generale et un detail structurel stable.",
  sourceIdsByField: {
    keyDifference: [],
    whyTempting: [],
    nextLookFor: [],
  },
  support: {
    level: 'fallback',
    sourceIds: [],
  },
  supportByField: {
    keyDifference: [],
    whyTempting: [],
    nextLookFor: [],
  },
});

const buildUnavailablePhotoFull = ({ language }) => {
  if (language === 'en') {
    return {
      photoSummary: 'The round photo could not be analysed reliably.',
      observedClues: [],
      whyThisPhotoCouldMislead: 'This image does not offer a reliable enough reading for a photo-specific explanation.',
      nextCheck: 'Keep the quick hint and recheck one clear structural clue on the photo.',
      caution: 'Photo analysis unavailable for this image.',
      support: { level: 'unavailable', sourceIds: [] },
      supportByField: {
        photoSummary: [],
        observedClues: [],
        whyThisPhotoCouldMislead: [],
        nextCheck: [],
        caution: [],
      },
      sourceIdsByField: {
        photoSummary: [],
        observedClues: [],
        whyThisPhotoCouldMislead: [],
        nextCheck: [],
        caution: [],
      },
      imageAnalysis: {
        source: 'round_photo',
        downscaled: true,
        inputBucket: '<=384-target',
      },
    };
  }
  if (language === 'nl') {
    return {
      photoSummary: 'De foto van deze ronde kon niet betrouwbaar worden geanalyseerd.',
      observedClues: [],
      whyThisPhotoCouldMislead: 'Deze afbeelding is niet duidelijk genoeg voor een echt foto-specifieke uitleg.',
      nextCheck: 'Gebruik de korte hint en controleer op de foto één duidelijk structureel kenmerk.',
      caution: 'Fotoanalyse niet beschikbaar voor deze afbeelding.',
      support: { level: 'unavailable', sourceIds: [] },
      supportByField: {
        photoSummary: [],
        observedClues: [],
        whyThisPhotoCouldMislead: [],
        nextCheck: [],
        caution: [],
      },
      sourceIdsByField: {
        photoSummary: [],
        observedClues: [],
        whyThisPhotoCouldMislead: [],
        nextCheck: [],
        caution: [],
      },
      imageAnalysis: {
        source: 'round_photo',
        downscaled: true,
        inputBucket: '<=384-target',
      },
    };
  }
  return {
    photoSummary: "Je n'ai pas pu analyser cette photo de manche de façon fiable.",
    observedClues: [],
    whyThisPhotoCouldMislead:
      "Cette image n'offre pas une lecture assez sûre pour une explication vraiment centrée sur la photo.",
    nextCheck: 'Garde le repère rapide et vérifie un détail structurel net sur la photo.',
    caution: 'Analyse photo indisponible pour cette image.',
    support: { level: 'unavailable', sourceIds: [] },
    supportByField: {
      photoSummary: [],
      observedClues: [],
      whyThisPhotoCouldMislead: [],
      nextCheck: [],
      caution: [],
    },
    sourceIdsByField: {
      photoSummary: [],
      observedClues: [],
      whyThisPhotoCouldMislead: [],
      nextCheck: [],
      caution: [],
    },
    imageAnalysis: {
      source: 'round_photo',
      downscaled: true,
      inputBucket: '<=384-target',
    },
  };
};

const normalizeExplanationPayload = ({ data, language, correctName, wrongName }) => {
  const normalizedSources = normalizeAiSources(data?.sources);
  const confidence = data?.confidence || (data?.fallback ? 'fallback' : 'grounded');
  const legacyExplanation = trimText(data?.explanation);
  const legacyPedagogy = data?.pedagogy;
  const full =
    data?.full ||
    (legacyExplanation
      ? {
          photoSummary: legacyExplanation,
          observedClues: [
            trimText(data?.discriminant) || trimText(legacyPedagogy?.visualClue),
          ].filter(Boolean),
          whyThisPhotoCouldMislead:
            trimText(legacyPedagogy?.whyThisConfusionHappens) || trimText(legacyPedagogy?.counterExample),
          nextCheck: trimText(legacyPedagogy?.visualClue) || trimText(legacyPedagogy?.taxonomicRule),
          caution: '',
          support: {
            level: confidence,
            sourceIds: [],
          },
          sourceIdsByField: {},
        }
      : null);
  const brief =
    data?.brief ||
    (legacyExplanation
      ? {
          keyDifference: trimText(data?.discriminant) || buildFallbackBrief({ language, correctName }).keyDifference,
          whyTempting:
            trimText(legacyPedagogy?.counterExample) ||
            buildFallbackBrief({ language, correctName }).whyTempting,
          nextLookFor:
            trimText(legacyPedagogy?.visualClue) ||
            buildFallbackBrief({ language, correctName }).nextLookFor,
          displayText: legacyExplanation,
          sourceIdsByField: {
            keyDifference: [],
            whyTempting: [],
            nextLookFor: [],
          },
          support: {
            level: confidence,
            sourceIds: [],
          },
          supportByField: {
            keyDifference: [],
            whyTempting: [],
            nextLookFor: [],
          },
        }
      : null);
  const normalizedBrief = brief
    ? {
        ...brief,
        supportByField: brief.supportByField || brief.sourceIdsByField || {
          keyDifference: [],
          whyTempting: [],
          nextLookFor: [],
        },
        sourceIdsByField: brief.supportByField || brief.sourceIdsByField || {
          keyDifference: [],
          whyTempting: [],
          nextLookFor: [],
        },
        support: brief.support || {
          level: confidence,
          sourceIds: Array.from(
            new Set(
              Object.values(brief.supportByField || brief.sourceIdsByField || {})
                .flat()
                .filter(Boolean)
            )
          ),
        },
      }
    : null;
  const normalizedFull = full
    ? {
        photoSummary: trimText(full.photoSummary || full.explanation),
        observedClues: Array.isArray(full.observedClues)
          ? full.observedClues.map((value) => trimText(value)).filter(Boolean).slice(0, 3)
          : [trimText(full.visualClue), trimText(full.discriminant)].filter(Boolean).slice(0, 3),
        whyThisPhotoCouldMislead: trimText(
          full.whyThisPhotoCouldMislead || full.whyThisConfusionHappens || full.counterExample
        ),
        nextCheck: trimText(full.nextCheck || full.taxonomicRule),
        caution: trimText(full.caution),
        imageAnalysis: full.imageAnalysis || null,
        support: full.support || {
          level: confidence,
          sourceIds: Array.from(
            new Set(
              Object.values(full.supportByField || full.sourceIdsByField || {})
                .flat()
                .filter(Boolean)
            )
          ),
        },
        supportByField: {
          photoSummary:
            full.supportByField?.photoSummary ||
            full.sourceIdsByField?.photoSummary ||
            full.supportByField?.explanation ||
            full.sourceIdsByField?.explanation ||
            [],
          observedClues:
            full.supportByField?.observedClues ||
            full.sourceIdsByField?.observedClues ||
            full.supportByField?.visualClue ||
            full.sourceIdsByField?.visualClue ||
            full.supportByField?.discriminant ||
            full.sourceIdsByField?.discriminant ||
            [],
          whyThisPhotoCouldMislead:
            full.supportByField?.whyThisPhotoCouldMislead ||
            full.sourceIdsByField?.whyThisPhotoCouldMislead ||
            full.supportByField?.whyThisConfusionHappens ||
            full.sourceIdsByField?.whyThisConfusionHappens ||
            full.supportByField?.counterExample ||
            full.sourceIdsByField?.counterExample ||
            [],
          nextCheck:
            full.supportByField?.nextCheck ||
            full.sourceIdsByField?.nextCheck ||
            full.supportByField?.taxonomicRule ||
            full.sourceIdsByField?.taxonomicRule ||
            [],
          caution:
            full.supportByField?.caution ||
            full.sourceIdsByField?.caution ||
            [],
        },
        sourceIdsByField: {
          photoSummary:
            full.supportByField?.photoSummary ||
            full.sourceIdsByField?.photoSummary ||
            full.supportByField?.explanation ||
            full.sourceIdsByField?.explanation ||
            [],
          observedClues:
            full.supportByField?.observedClues ||
            full.sourceIdsByField?.observedClues ||
            full.supportByField?.visualClue ||
            full.sourceIdsByField?.visualClue ||
            full.supportByField?.discriminant ||
            full.sourceIdsByField?.discriminant ||
            [],
          whyThisPhotoCouldMislead:
            full.supportByField?.whyThisPhotoCouldMislead ||
            full.sourceIdsByField?.whyThisPhotoCouldMislead ||
            full.supportByField?.whyThisConfusionHappens ||
            full.sourceIdsByField?.whyThisConfusionHappens ||
            full.supportByField?.counterExample ||
            full.sourceIdsByField?.counterExample ||
            [],
          nextCheck:
            full.supportByField?.nextCheck ||
            full.sourceIdsByField?.nextCheck ||
            full.supportByField?.taxonomicRule ||
            full.sourceIdsByField?.taxonomicRule ||
            [],
          caution:
            full.supportByField?.caution ||
            full.sourceIdsByField?.caution ||
            [],
        },
      }
    : null;
  return {
    mode: data?.mode || (data?.full ? 'full' : 'brief'),
    brief: normalizedBrief,
    full: normalizedFull,
    sources: normalizedSources,
    confidence,
    fallback: Boolean(data?.fallback),
    traceId: data?.trace_id || data?.traceId || null,
    pairKey: data?.pair_key || data?.pairKey || null,
    severity: data?.severity || null,
  };
};

const RoundSummaryModal = ({ status, question, onNext, userAnswer, explanationContext }) => {
  const { t, language, getTaxonDisplayNames } = useLanguage();
  const { profile } = useUser();
  const { activePackId, gameMode } = useGameData();
  const lang = language; // Alias pour compatibilité
  const [briefData, setBriefData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [aiSources, setAiSources] = useState([]);
  const [briefConfidence, setBriefConfidence] = useState('grounded');
  const [fullConfidence, setFullConfidence] = useState('unavailable');
  const [briefTraceId, setBriefTraceId] = useState(null);
  const [fullTraceId, setFullTraceId] = useState(null);
  const [briefPairKey, setBriefPairKey] = useState(null);
  const [fullPairKey, setFullPairKey] = useState(null);
  const [fullUsedFallback, setFullUsedFallback] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [hasRequestedFull, setHasRequestedFull] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [userDetailOverride, setUserDetailOverride] = useState(null);
  const [explanationFeedback, setExplanationFeedback] = useState(null);
  const buttonRef = useRef(null);
  const trackedExplanationOpenRef = useRef(null);
  const trackedSourcesExpandRef = useRef(false);
  const trackedRenderedRef = useRef(null);
  const trackedBadgeRef = useRef(null);
  const pairKeyRef = useRef(null);
  const briefRequestRef = useRef(0);
  const fullRequestRef = useRef(0);
  const isWin = status === 'win';

  // Helper to extract relevant details from a taxon object, handling EasyMode's 'detail' structure
  const getTaxonDetailsForDisplay = useCallback((taxonData) => {
    const actualTaxon = taxonData?.detail || taxonData;
    if (!actualTaxon) return {};

    const { primary, secondary } = getTaxonDisplayNames(actualTaxon);
    const defaultPhoto = actualTaxon.default_photo || {};
    const imageUrl =
      defaultPhoto.url ||
      defaultPhoto.medium_url ||
      defaultPhoto.large_url ||
      defaultPhoto.square_url ||
      actualTaxon.image_url;
    return {
      id: actualTaxon.id || actualTaxon.taxon_id,
      image_url: imageUrl,
      wikipedia_url: toSafeHttpUrl(actualTaxon.wikipedia_url),
      inaturalist_url:
        toSafeHttpUrl(actualTaxon.url) ||
        (actualTaxon.id || actualTaxon.taxon_id
          ? toSafeHttpUrl(`https://www.inaturalist.org/taxa/${actualTaxon.id || actualTaxon.taxon_id}`)
          : null),
      primaryName: primary,
      secondaryName: secondary,
      scientificName: actualTaxon.name || '',
    };
  }, [getTaxonDisplayNames]);

  const correctDisplayTaxon = useMemo(() => {
    const taxon = getTaxonDetailsForDisplay(question?.bonne_reponse);
    // Override iNaturalist URL with observation-specific one if available
    if (question?.inaturalist_url) {
      taxon.inaturalist_url = toSafeHttpUrl(question.inaturalist_url);
    }
    return taxon;
  }, [question, getTaxonDetailsForDisplay]);

  const baseUserId =
    userAnswer?.detail?.id || userAnswer?.id || userAnswer?.taxon_id || null;
  const userDisplayTaxon = useMemo(
    () => getTaxonDetailsForDisplay(userDetailOverride || userAnswer),
    [userDetailOverride, userAnswer, getTaxonDetailsForDisplay]
  );
  const explanationCorrectId = explanationContext?.correctId || correctDisplayTaxon.id;
  const explanationWrongId = explanationContext?.wrongId || userDisplayTaxon.id;
  const explanationFocusRank = explanationContext?.focusRank || null;
  const pairBaseKey = useMemo(
    () => `${question?.round_id || 'no-round'}:${explanationCorrectId || 'na'}:${explanationWrongId || 'na'}`,
    [question?.round_id, explanationCorrectId, explanationWrongId]
  );
  const roundPhotoUrl = useMemo(() => getQuestionThumbnail(question), [question]);
  const roundPhotoMeta = useMemo(
    () => (Array.isArray(question?.image_meta) && question.image_meta.length > 0 ? question.image_meta[0] : null),
    [question?.image_meta]
  );
  const roundPhotoAnalysisUrl = useMemo(
    () => (roundPhotoUrl ? getSizedImageUrl(roundPhotoUrl, 'small') : null),
    [roundPhotoUrl]
  );
  const userWikiUrl = useMemo(() => {
    if (userDisplayTaxon.wikipedia_url) return userDisplayTaxon.wikipedia_url;
    if (!userDisplayTaxon.scientificName) return null;
    return toSafeHttpUrl(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(userDisplayTaxon.scientificName)}`);
  }, [userDisplayTaxon.wikipedia_url, userDisplayTaxon.scientificName, lang]);
  const pedagogyFallbackNames = useMemo(() => ({
    correctName: correctDisplayTaxon.primaryName || correctDisplayTaxon.secondaryName || null,
    wrongName: userDisplayTaxon.primaryName || userDisplayTaxon.secondaryName || null,
  }), [correctDisplayTaxon.primaryName, correctDisplayTaxon.secondaryName, userDisplayTaxon.primaryName, userDisplayTaxon.secondaryName]);
  const hasFullAnalysisContent = useMemo(
    () =>
      Boolean(
        fullData?.photoSummary ||
          (Array.isArray(fullData?.observedClues) && fullData.observedClues.length > 0) ||
          fullData?.whyThisPhotoCouldMislead ||
          fullData?.nextCheck ||
          fullData?.caution
      ),
    [fullData]
  );
  const sourceCoverageById = useMemo(() => {
    const coverage = new Map();
    const register = (sourceIdsByField, labels) => {
      if (!sourceIdsByField || typeof sourceIdsByField !== 'object') return;
      Object.entries(sourceIdsByField).forEach(([field, ids]) => {
        const label = labels[field];
        if (!label || !Array.isArray(ids)) return;
        ids.forEach((id) => {
          if (!id) return;
          if (!coverage.has(id)) coverage.set(id, []);
          const current = coverage.get(id);
          if (!current.includes(label)) current.push(label);
        });
      });
    };

    register(briefData?.supportByField || briefData?.sourceIdsByField, {
      keyDifference: t('summary.brief_key_difference_title', {}, 'Ce qui distingue'),
      whyTempting: t('summary.brief_why_tempting_title', {}, 'Pourquoi la confusion'),
      nextLookFor: t('summary.brief_next_look_for_title', {}, 'A regarder'),
    });
    register(fullData?.supportByField || fullData?.sourceIdsByField, {
      photoSummary: t('summary.photo_analysis_summary_title', {}, "Ce que l'on voit ici"),
      observedClues: t('summary.photo_analysis_clues_title', {}, 'Repères visibles'),
      whyThisPhotoCouldMislead: t('summary.photo_analysis_mislead_title', {}, 'Ce qui a pu tromper'),
      nextCheck: t('summary.photo_analysis_next_check_title', {}, 'Le détail à vérifier'),
      caution: t('summary.photo_analysis_caution_title', {}, 'Lecture prudente'),
    });
    return coverage;
  }, [briefData?.supportByField, briefData?.sourceIdsByField, fullData?.supportByField, fullData?.sourceIdsByField, t]);
  const masteryBucket = useMemo(() => {
    const correctCount = Number(profile?.stats?.speciesMastery?.[explanationCorrectId]?.correct || 0);
    if (correctCount >= 3) return 'familiar';
    if (correctCount >= 1) return 'fragile';
    return 'new';
  }, [explanationCorrectId, profile?.stats?.speciesMastery]);
  const confusionBucket = useMemo(() => {
    const missedSpecies = new Set(profile?.stats?.missedSpecies || []);
    return missedSpecies.has(Number(explanationCorrectId)) || missedSpecies.has(Number(explanationWrongId))
      ? 'repeat'
      : 'first';
  }, [explanationCorrectId, explanationWrongId, profile?.stats?.missedSpecies]);
  const confidenceLabel = useMemo(() => {
    if (briefConfidence === 'fallback') return t('summary.confidence_fallback', {}, 'Conseil générique');
    if (briefConfidence === 'model_guided') return t('summary.confidence_model_guided', {}, 'Sources cohérentes');
    if (briefConfidence === 'limited') return t('summary.confidence_limited', {}, 'Sources limitées');
    return t('summary.confidence_grounded', {}, 'Sources reliées');
  }, [briefConfidence, t]);
  const fullConfidenceLabel = useMemo(() => {
    if (fullConfidence === 'photo_grounded' || fullConfidence === 'grounded') {
      return t('summary.photo_confidence_grounded', {}, 'Analyse photo fiable');
    }
    if (fullConfidence === 'photo_limited' || fullConfidence === 'model_guided' || fullConfidence === 'limited') {
      return t('summary.photo_confidence_limited', {}, 'Analyse photo prudente');
    }
    return t('summary.photo_confidence_unavailable', {}, 'Analyse photo indisponible');
  }, [fullConfidence, t]);
  const visibleSourceIds = useMemo(() => {
    const ids = new Set();
    const register = (sourceIdsByField) => {
      if (!sourceIdsByField || typeof sourceIdsByField !== 'object') return;
      Object.values(sourceIdsByField).forEach((values) => {
        (values || []).forEach((id) => {
          if (id) ids.add(id);
        });
      });
    };
    register(briefData?.supportByField || briefData?.sourceIdsByField);
    if (hasRequestedFull) {
      register(fullData?.supportByField || fullData?.sourceIdsByField);
    }
    return Array.from(ids);
  }, [briefData?.supportByField, briefData?.sourceIdsByField, fullData?.supportByField, fullData?.sourceIdsByField, hasRequestedFull]);
  const visibleSources = useMemo(
    () => aiSources.filter((source) => visibleSourceIds.includes(source.id)),
    [aiSources, visibleSourceIds]
  );
  const sourceProviders = useMemo(() => {
    return Array.from(
      new Set(
        visibleSources.map(
          (source) => SOURCE_PROVIDER_LABELS[source.provider] || source.provider || SOURCE_PROVIDER_LABELS.unknown
        )
      )
    );
  }, [visibleSources]);
  const visibleSourceKindSummary = useMemo(() => {
    const image = visibleSources.filter((source) => source.kind === 'image').length;
    const descriptive = visibleSources.filter((source) => source.kind === 'description').length;
    const taxonomic = visibleSources.filter((source) => ['taxonomy', 'synonymy'].includes(source.kind)).length;
    const other = visibleSources.filter((source) => !['image', 'description', 'taxonomy', 'synonymy'].includes(source.kind)).length;
    const parts = [];
    if (image > 0) {
      parts.push(t('summary.sources_image_count', { count: image }, `${image} photo du round`));
    }
    if (descriptive > 0) {
      parts.push(t('summary.sources_descriptive_count', { count: descriptive }, `${descriptive} sources descriptives`));
    }
    if (taxonomic > 0) {
      parts.push(t('summary.sources_taxonomic_count', { count: taxonomic }, `${taxonomic} sources taxonomiques`));
    }
    if (other > 0) {
      parts.push(t('summary.sources_other_count', { count: other }, `${other} autres sources`));
    }
    return parts.join(' · ');
  }, [t, visibleSources]);

  useEffect(() => {
    setUserDetailOverride(null);
  }, [baseUserId]);

  useEffect(() => {
    pairKeyRef.current = pairBaseKey;
  }, [pairBaseKey]);

  useEffect(() => {
    let isActive = true;
    if (isWin || !baseUserId) return () => {};
    const needsPhoto = !userDisplayTaxon.image_url;
    const needsWiki = !userDisplayTaxon.wikipedia_url;
    if (!needsPhoto && !needsWiki) return () => {};

    getTaxonDetails(baseUserId, lang)
      .then((detail) => {
        if (isActive && detail) {
          setUserDetailOverride(detail);
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, [isWin, baseUserId, userDisplayTaxon.image_url, userDisplayTaxon.wikipedia_url, lang]);

  useEffect(() => {
    let isActive = true;
    if (isWin || !explanationCorrectId || !explanationWrongId) return () => {};
    const requestPairKey = `${pairBaseKey}:brief`;
    const requestId = ++briefRequestRef.current;

    const run = async () => {
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        if (!isActive) return;
        timedOut = true;
        setBriefData(buildFallbackBrief({ language: lang, correctName: pedagogyFallbackNames.correctName }));
        setBriefConfidence('fallback');
        setBriefTraceId(null);
        setBriefPairKey(requestPairKey);
        setAiSources([]);
        setBriefLoading(false);
        void trackMetric('explanation_brief_fallback', {
          round_id: question?.round_id || null,
          correct_taxon_id: String(explanationCorrectId),
          wrong_taxon_id: String(explanationWrongId),
          code: 'client_timeout',
        });
      }, 2200);
      setBriefLoading(true);
      setBriefData(null);
      setFullData(null);
      setBriefConfidence('grounded');
      setFullConfidence('unavailable');
      setFullUsedFallback(false);
      setAiSources([]);
      setBriefTraceId(null);
      setFullTraceId(null);
      setBriefPairKey(requestPairKey);
      setFullPairKey(null);
      void trackMetric('explanation_brief_requested', {
        round_id: question?.round_id || null,
        correct_taxon_id: String(explanationCorrectId),
        wrong_taxon_id: String(explanationWrongId),
        pack_id: activePackId || null,
        game_mode: gameMode || null,
        mastery_bucket: masteryBucket,
        confusion_bucket: confusionBucket,
      });
      try {
        const data = await fetchExplanation({
          correctId: explanationCorrectId,
          wrongId: explanationWrongId,
          locale: lang,
          mode: 'brief',
          focusRank: explanationFocusRank,
          packId: activePackId || null,
          gameMode: gameMode || null,
          masteryBucket,
          confusionBucket,
        });
        if (!isActive) return;
        clearTimeout(timeoutId);
        if (timedOut) return;
        if (pairKeyRef.current !== pairBaseKey || briefRequestRef.current !== requestId) {
          void trackMetric('explanation_render_ignored_stale', {
            trace_id: data?.trace_id || data?.traceId || null,
            pair_key: requestPairKey,
            mode: 'brief',
          });
          return;
        }
        const normalized = normalizeExplanationPayload({
          data,
          language: lang,
          correctName: pedagogyFallbackNames.correctName,
          wrongName: pedagogyFallbackNames.wrongName,
        });
        setBriefData(normalized.brief || buildFallbackBrief({ language: lang, correctName: pedagogyFallbackNames.correctName }));
        setAiSources(normalized.sources);
        setBriefConfidence(normalized.brief?.support?.level || normalized.confidence);
        setBriefTraceId(normalized.traceId);
        setBriefPairKey(normalized.pairKey || requestPairKey);
        void trackMetric('explanation_brief_loaded', {
          round_id: question?.round_id || null,
          correct_taxon_id: String(explanationCorrectId),
          wrong_taxon_id: String(explanationWrongId),
          fallback: normalized.fallback,
          confidence: normalized.brief?.support?.level || normalized.confidence,
          source_count: normalized.sources.length,
          trace_id: normalized.traceId,
          pair_key: normalized.pairKey || requestPairKey,
        });
        if (normalized.fallback) {
          void trackMetric('explanation_brief_fallback', {
            round_id: question?.round_id || null,
            correct_taxon_id: String(explanationCorrectId),
            wrong_taxon_id: String(explanationWrongId),
            trace_id: normalized.traceId,
            pair_key: normalized.pairKey || requestPairKey,
          });
        }
        void trackMetric('explanation_confidence', {
          round_id: question?.round_id || null,
          correct_taxon_id: String(explanationCorrectId),
          wrong_taxon_id: String(explanationWrongId),
          confidence: normalized.brief?.support?.level || normalized.confidence,
          mode: 'brief',
          trace_id: normalized.traceId,
          pair_key: normalized.pairKey || requestPairKey,
        });
      } catch (error) {
        if (!isActive) return;
        clearTimeout(timeoutId);
        if (timedOut) return;
        setBriefData(buildFallbackBrief({ language: lang, correctName: pedagogyFallbackNames.correctName }));
        setBriefConfidence('fallback');
        setBriefPairKey(requestPairKey);
        setAiSources([]);
        void trackMetric('explanation_brief_fallback', {
          round_id: question?.round_id || null,
          correct_taxon_id: String(explanationCorrectId),
          wrong_taxon_id: String(explanationWrongId),
          code: error?.code || null,
          pair_key: requestPairKey,
        });
      } finally {
        clearTimeout(timeoutId);
        if (isActive && !timedOut) setBriefLoading(false);
      }
    };

    run();
    return () => {
      isActive = false;
    };
  }, [
    activePackId,
    confusionBucket,
    explanationCorrectId,
    explanationFocusRank,
    explanationWrongId,
    gameMode,
    isWin,
    lang,
    masteryBucket,
    pairBaseKey,
    pedagogyFallbackNames.correctName,
    pedagogyFallbackNames.wrongName,
    question?.round_id,
  ]);

  useEffect(() => {
    trackedExplanationOpenRef.current = null;
    trackedSourcesExpandRef.current = false;
    trackedRenderedRef.current = null;
    trackedBadgeRef.current = null;
    setHasRequestedFull(false);
    setSourcesExpanded(false);
    setExplanationFeedback(null);
    setFullLoading(false);
    setFullUsedFallback(false);
    setFullData(null);
    setFullConfidence('unavailable');
    setFullTraceId(null);
    setFullPairKey(null);
  }, [explanationCorrectId, explanationWrongId, isWin, pairBaseKey]);

  useEffect(() => {
    if (
      isWin ||
      fullLoading ||
      !hasFullAnalysisContent ||
      !explanationCorrectId ||
      !explanationWrongId ||
      !hasRequestedFull
    ) {
      return;
    }
    const key = `${explanationCorrectId}:${explanationWrongId}`;
    if (trackedExplanationOpenRef.current === key) return;
    trackedExplanationOpenRef.current = key;

    void trackMetric('explanation_open', {
      round_id: question?.round_id || null,
      correct_taxon_id: String(explanationCorrectId),
      wrong_taxon_id: String(explanationWrongId),
      focus_rank: explanationFocusRank || null,
    });
  }, [
    hasFullAnalysisContent,
    hasRequestedFull,
    explanationCorrectId,
    explanationFocusRank,
    explanationWrongId,
    fullLoading,
    isWin,
    question?.round_id,
  ]);

  const loadFullExplanation = useCallback(async () => {
    if (
      !FULL_EXPLANATION_ENABLED ||
      isWin ||
      fullLoading ||
      hasRequestedFull ||
      !explanationCorrectId ||
      !explanationWrongId
    ) {
      return;
    }
    const requestPairKey = `${pairBaseKey}:full`;
    const requestId = ++fullRequestRef.current;
    setHasRequestedFull(true);
    setFullLoading(true);
    void trackMetric('explanation_full_requested', {
      round_id: question?.round_id || null,
      correct_taxon_id: String(explanationCorrectId),
      wrong_taxon_id: String(explanationWrongId),
      pack_id: activePackId || null,
      game_mode: gameMode || null,
      mastery_bucket: masteryBucket,
      confusion_bucket: confusionBucket,
    });
    try {
      const data = await fetchExplanation({
        correctId: explanationCorrectId,
        wrongId: explanationWrongId,
        locale: lang,
        mode: 'full',
        focusRank: explanationFocusRank,
        packId: activePackId || null,
        gameMode: gameMode || null,
        masteryBucket,
        confusionBucket,
        imageContext: roundPhotoAnalysisUrl
          ? {
              source: 'round_photo',
              url: roundPhotoAnalysisUrl,
              width: roundPhotoMeta?.width || null,
              height: roundPhotoMeta?.height || null,
              downscaled: true,
              inputBucket: '<=384-target',
            }
          : null,
      });
      if (pairKeyRef.current !== pairBaseKey || fullRequestRef.current !== requestId) {
        void trackMetric('explanation_render_ignored_stale', {
          trace_id: data?.trace_id || data?.traceId || null,
          pair_key: requestPairKey,
          mode: 'full',
        });
        return;
      }
      const normalized = normalizeExplanationPayload({
        data,
        language: lang,
        correctName: pedagogyFallbackNames.correctName,
        wrongName: pedagogyFallbackNames.wrongName,
      });
      setAiSources((prev) => {
        const byId = new Map();
        [...prev, ...normalized.sources].forEach((source) => {
          if (source?.id) byId.set(source.id, source);
        });
        return Array.from(byId.values());
      });
      setFullConfidence(normalized.full?.support?.level || normalized.confidence || 'unavailable');
      setFullTraceId(normalized.traceId);
      setFullPairKey(normalized.pairKey || requestPairKey);
      setFullUsedFallback(Boolean(normalized.fallback) || (normalized.full?.support?.level || normalized.confidence) === 'unavailable');
      setFullData(normalized.full || buildUnavailablePhotoFull({ language: lang }));
      void trackMetric('explanation_full_loaded', {
        round_id: question?.round_id || null,
        correct_taxon_id: String(explanationCorrectId),
        wrong_taxon_id: String(explanationWrongId),
        fallback: normalized.fallback,
        confidence: normalized.full?.support?.level || normalized.confidence,
        source_count: normalized.sources.length,
        trace_id: normalized.traceId,
        pair_key: normalized.pairKey || requestPairKey,
      });
      void trackMetric('explanation_confidence', {
        round_id: question?.round_id || null,
        correct_taxon_id: String(explanationCorrectId),
        wrong_taxon_id: String(explanationWrongId),
        confidence: normalized.full?.support?.level || normalized.confidence,
        mode: 'full',
        trace_id: normalized.traceId,
        pair_key: normalized.pairKey || requestPairKey,
      });
    } catch (error) {
      if (pairKeyRef.current !== pairBaseKey || fullRequestRef.current !== requestId) {
        void trackMetric('explanation_render_ignored_stale', {
          pair_key: requestPairKey,
          mode: 'full',
        });
        return;
      }
      setFullConfidence('unavailable');
      setFullUsedFallback(true);
      setFullPairKey(requestPairKey);
      setFullData(buildUnavailablePhotoFull({ language: lang }));
      void trackMetric('explanation_full_loaded', {
        round_id: question?.round_id || null,
        correct_taxon_id: String(explanationCorrectId),
        wrong_taxon_id: String(explanationWrongId),
        fallback: true,
        confidence: 'unavailable',
        code: error?.code || null,
        pair_key: requestPairKey,
      });
    } finally {
      if (pairKeyRef.current === pairBaseKey && fullRequestRef.current === requestId) {
        setFullLoading(false);
      }
    }
  }, [
    activePackId,
    confusionBucket,
    explanationCorrectId,
    explanationFocusRank,
    explanationWrongId,
    fullLoading,
    gameMode,
    hasRequestedFull,
    isWin,
    lang,
    masteryBucket,
    pairBaseKey,
    question?.round_id,
    roundPhotoAnalysisUrl,
    roundPhotoMeta?.height,
    roundPhotoMeta?.width,
  ]);

  const toggleSourcesExpanded = useCallback(() => {
    setSourcesExpanded((prev) => {
      const next = !prev;
      if (next && !trackedSourcesExpandRef.current) {
        trackedSourcesExpandRef.current = true;
        void trackMetric('explanation_source_expand', {
          round_id: question?.round_id || null,
          correct_taxon_id: explanationCorrectId ? String(explanationCorrectId) : null,
          wrong_taxon_id: explanationWrongId ? String(explanationWrongId) : null,
          source_count: visibleSources.length,
          trace_id: fullTraceId || briefTraceId || null,
          pair_key: fullPairKey || briefPairKey || `${pairBaseKey}:brief`,
        });
      }
      return next;
    });
  }, [briefPairKey, briefTraceId, explanationCorrectId, explanationWrongId, fullPairKey, fullTraceId, pairBaseKey, question?.round_id, visibleSources.length]);

  const handleExplanationFeedback = useCallback(
    (isUseful) => {
      if (!hasRequestedFull || !hasFullAnalysisContent || fullLoading || explanationFeedback !== null) return;
      if (fullConfidence === 'unavailable') return;
      setExplanationFeedback(isUseful);
      void trackMetric('explanation_feedback', {
        useful: Boolean(isUseful),
        round_id: question?.round_id || null,
        correct_taxon_id: explanationCorrectId ? String(explanationCorrectId) : null,
        wrong_taxon_id: explanationWrongId ? String(explanationWrongId) : null,
        focus_rank: explanationFocusRank || null,
        trace_id: fullTraceId || briefTraceId || null,
        pair_key: fullPairKey || briefPairKey || `${pairBaseKey}:brief`,
      });
    },
    [
      briefPairKey,
      briefTraceId,
      hasRequestedFull,
      hasFullAnalysisContent,
      explanationCorrectId,
      explanationFeedback,
      explanationFocusRank,
      explanationWrongId,
      fullConfidence,
      fullPairKey,
      fullTraceId,
      fullLoading,
      pairBaseKey,
      question?.round_id,
    ]
  );

  useEffect(() => {
    if (isWin || briefLoading || !briefData) return;
    const renderedKey = `${pairBaseKey}:brief:${briefConfidence}:${briefTraceId || 'no-trace'}`;
    if (trackedRenderedRef.current === renderedKey) return;
    trackedRenderedRef.current = renderedKey;
    void trackMetric('explanation_rendered', {
      trace_id: briefTraceId,
      pair_key: briefPairKey || `${pairBaseKey}:brief`,
      mode: 'brief',
      displayed_confidence: briefConfidence,
      displayed_fallback: briefConfidence === 'fallback',
      has_full_visible: false,
    });
  }, [briefConfidence, briefData, briefLoading, briefPairKey, briefTraceId, isWin, pairBaseKey]);

  useEffect(() => {
    if (isWin || !hasRequestedFull || fullLoading || !fullData) return;
    const renderedKey = `${pairBaseKey}:full:${fullConfidence}:${fullTraceId || 'no-trace'}:${fullUsedFallback}`;
    if (trackedRenderedRef.current === renderedKey) return;
    trackedRenderedRef.current = renderedKey;
    void trackMetric('explanation_rendered', {
      trace_id: fullTraceId || briefTraceId,
      pair_key: fullPairKey || `${pairBaseKey}:full`,
      mode: 'full',
      displayed_confidence: fullConfidence,
      displayed_fallback: fullConfidence === 'unavailable',
      has_full_visible: true,
    });
  }, [
    briefTraceId,
    fullConfidence,
    fullData,
    fullLoading,
    fullPairKey,
    fullTraceId,
    fullUsedFallback,
    hasRequestedFull,
    isWin,
    pairBaseKey,
  ]);

  useEffect(() => {
    if (isWin || briefLoading || !briefData) return;
    const badgeKey = `${pairBaseKey}:${briefConfidence}:brief`;
    if (trackedBadgeRef.current === badgeKey) return;
    trackedBadgeRef.current = badgeKey;
    void trackMetric('explanation_badge_displayed', {
      trace_id: briefTraceId,
      pair_key: briefPairKey || `${pairBaseKey}:brief`,
      displayed_confidence: briefConfidence,
      displayed_fallback: briefConfidence === 'fallback',
      has_full_visible: Boolean(hasRequestedFull && fullData),
    });
  }, [
    briefData,
    briefLoading,
    briefPairKey,
    briefTraceId,
    briefConfidence,
    fullData,
    hasRequestedFull,
    isWin,
    pairBaseKey,
  ]);

  // Enter key → advance to next question (Escape is handled by BottomSheet)
  useEffect(() => {
    const handleEnter = (event) => {
      if (event.key === 'Enter') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [onNext]);

  if (!question || !question.bonne_reponse) {
    return null;
  }

  const title = isWin ? t('summary.win_title') : t('summary.lose_title');
  const correctImageUrl = getObservationImageUrl(question?.bonne_reponse) || correctDisplayTaxon.image_url;
  const sheetSnapPoints = isWin ? [0.56, 0.68, 0.82] : [0.45, 0.85, 1];
  const sourceToggleLabel = sourcesExpanded
    ? t('summary.sources_toggle_hide', {}, 'Masquer les sources')
    : t('summary.sources_toggle_show', {}, 'Voir les sources');
  const renderSourceKind = (kind) =>
    t(`summary.source_kind_${kind}`, {}, kind || t('summary.source_kind_description', {}, 'Description'));

  return (
    <BottomSheet
      open={true}
      onClose={onNext}
      initialSnap={1}
      snapPoints={sheetSnapPoints}
      className={`summary-sheet ${isWin ? 'summary-sheet--win' : 'summary-sheet--lose'}`}
      ariaLabel={title}
      overlayClose={false}
    >
      <div className={`summary-modal ${isWin ? 'summary-modal--win' : 'summary-modal--lose summary-modal--wide'}`} aria-labelledby="summary-title">
        <header className="summary-header">
          <h2 id="summary-title" className={`summary-title ${isWin ? 'win' : 'lose'}`}>
        
            {title}
          </h2>
        </header>

        <div className="summary-body">
          <div className="answers-container">
            {/* Correct Answer Card */}
            <div className={`answer-card correct-answer-card ${isWin ? 'full-width' : ''}`}>
              <h3 className="answer-card-title">{t('summary.correct_answer')}</h3>
              <div className="answer-card-body">
                {correctImageUrl && (
                  <div className="answer-image-wrapper">
                    <img
                      src={getSizedImageUrl(correctImageUrl, 'medium')}
                      srcSet={`${getSizedImageUrl(correctImageUrl, 'small')} 300w, ${getSizedImageUrl(correctImageUrl, 'medium')} 600w`}
                      sizes="(max-width: 768px) 120px, 200px"
                      alt={correctDisplayTaxon.primaryName || correctDisplayTaxon.secondaryName}
                      className="answer-image"
                      {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                    />
                  </div>
                )}
                <div className="answer-details">
                  {correctDisplayTaxon.primaryName && <p className="answer-name">{correctDisplayTaxon.primaryName}</p>}
                  {correctDisplayTaxon.secondaryName && <p className="answer-scientific-name"><em>{correctDisplayTaxon.secondaryName}</em></p>}
                  <div className="external-links-container modal-links">
                    {correctDisplayTaxon.inaturalist_url && (
                      <a
                        href={correctDisplayTaxon.inaturalist_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                        aria-label={t('summary.links.inaturalist')}
                      >
                        <span className="external-link__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                            <path d="M4 12c3.4-4.3 8.3-6.2 12.7-6.2 2.5 0 3.9 1.1 3.9 2.9 0 2.7-3.1 5.6-8.2 5.6H8.5L5.5 18v-4.2H4z" />
                          </svg>
                        </span>
                        <span className="external-link__text">{t('summary.links.inaturalist')}</span>
                      </a>
                    )}
                    {correctDisplayTaxon.wikipedia_url && (
                      <a
                        href={correctDisplayTaxon.wikipedia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                        aria-label={t('summary.links.wikipedia')}
                      >
                        <span className="external-link__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                            <path d="M4 6h3l2.2 7.2L11.8 6h2.4l2.6 7.2L19 6h3l-4.1 12h-2.4L13 10.2 10.5 18H8.1L4 6z" />
                          </svg>
                        </span>
                        <span className="external-link__text">{t('summary.links.wikipedia')}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* User Answer Card (only if wrong) */}
            {!isWin && userAnswer && (
              <div className="answer-card user-answer-card">
                <h3 className="answer-card-title">{t('summary.your_answer')}</h3>
                <div className="answer-card-body">
                  {userDisplayTaxon.image_url && (
                    <div className="answer-image-wrapper">
                      <img
                        src={getSizedImageUrl(userDisplayTaxon.image_url, 'medium')}
                        srcSet={`${getSizedImageUrl(userDisplayTaxon.image_url, 'small')} 300w, ${getSizedImageUrl(userDisplayTaxon.image_url, 'medium')} 600w`}
                        sizes="(max-width: 768px) 120px, 200px"
                        alt={userDisplayTaxon.primaryName || userDisplayTaxon.secondaryName}
                        className="answer-image"
                        {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                      />
                    </div>
                  )}
                  <div className="answer-details">
                    {userDisplayTaxon.primaryName && <p className="answer-name">{userDisplayTaxon.primaryName}</p>}
                    {userDisplayTaxon.secondaryName && <p className="answer-scientific-name"><em>{userDisplayTaxon.secondaryName}</em></p>}
                    <div className="external-links-container modal-links">
                      {userDisplayTaxon.inaturalist_url && (
                        <a
                          href={userDisplayTaxon.inaturalist_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                          aria-label={t('summary.links.inaturalist')}
                        >
                          <span className="external-link__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M4 12c3.4-4.3 8.3-6.2 12.7-6.2 2.5 0 3.9 1.1 3.9 2.9 0 2.7-3.1 5.6-8.2 5.6H8.5L5.5 18v-4.2H4z" />
                            </svg>
                          </span>
                          <span className="external-link__text">{t('summary.links.inaturalist')}</span>
                        </a>
                      )}
                      {userWikiUrl && (
                        <a
                          href={userWikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                          aria-label={t('summary.links.wikipedia')}
                        >
                          <span className="external-link__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M4 6h3l2.2 7.2L11.8 6h2.4l2.6 7.2L19 6h3l-4.1 12h-2.4L13 10.2 10.5 18H8.1L4 6z" />
                            </svg>
                          </span>
                          <span className="external-link__text">{t('summary.links.wikipedia')}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Explanation Section (only if wrong) */}
          {!isWin && (
            <div className="summary-card explanation-section">
              <div className="explanation-section__header">
                <div>
                  <p className="explanation-section__eyebrow">
                    {t('summary.explanation_title', {}, 'Repere IA')}
                  </p>
                  <h3 className="explanation-section__headline">
                    {t('summary.explanation_title', {}, 'Repere IA')}
                  </h3>
                </div>
                <span className={`summary-confidence-badge summary-confidence-badge--${briefConfidence}`}>
                  {confidenceLabel}
                </span>
              </div>

              <div className="explanation-content">
                {briefLoading && !briefData ? (
                  <div className="explanation-brief-loading" aria-live="polite">
                    <div className="explanation-skeleton-line explanation-skeleton-line--wide"></div>
                    <div className="explanation-skeleton-line"></div>
                    <div className="explanation-skeleton-grid">
                      <div className="explanation-skeleton-card"></div>
                      <div className="explanation-skeleton-card"></div>
                      <div className="explanation-skeleton-card"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {briefData && (
                      <section className="explanation-brief" aria-live="polite">
                        <p className="explanation-section__text">{briefData.displayText}</p>
                        <div className="explanation-brief-grid">
                          <article className="explanation-brief-card">
                            <h4 className="explanation-brief-card__title">
                              {t('summary.brief_key_difference_title', {}, 'Ce qui distingue')}
                            </h4>
                            <p className="explanation-brief-card__text">{briefData.keyDifference}</p>
                          </article>
                          <article className="explanation-brief-card">
                            <h4 className="explanation-brief-card__title">
                              {t('summary.brief_why_tempting_title', {}, 'Pourquoi la confusion')}
                            </h4>
                            <p className="explanation-brief-card__text">{briefData.whyTempting}</p>
                          </article>
                          <article className="explanation-brief-card">
                            <h4 className="explanation-brief-card__title">
                              {t('summary.brief_next_look_for_title', {}, 'A regarder')}
                            </h4>
                            <p className="explanation-brief-card__text">{briefData.nextLookFor}</p>
                          </article>
                        </div>
                      </section>
                    )}

                    {FULL_EXPLANATION_ENABLED && !hasRequestedFull && (
                      <div className="explanation-detail-cta">
                        <button
                          type="button"
                          className="btn btn--secondary explanation-detail-btn"
                          onClick={loadFullExplanation}
                          disabled={fullLoading}
                        >
                          {fullLoading
                            ? t('summary.explanation_detail_loading', {}, 'Analyse photo en cours…')
                            : t('summary.explanation_detail_button', {}, 'Analyser cette photo')}
                        </button>
                      </div>
                    )}

                    {hasRequestedFull && (
                      <section className="explanation-detail-section" aria-live="polite">
                        <div className="explanation-detail-section__header">
                          <h4 className="explanation-detail-section__title">
                            {t('summary.explanation_detail_title', {}, 'Analyse de cette photo')}
                          </h4>
                          <span className={`summary-confidence-badge summary-confidence-badge--${fullConfidence}`}>
                            {fullConfidenceLabel}
                          </span>
                        </div>
                        {fullLoading && !hasFullAnalysisContent ? (
                          <div className="explanation-detail-loading">
                            <div className="explanation-skeleton-line explanation-skeleton-line--wide"></div>
                            <div className="explanation-skeleton-line"></div>
                            <div className="explanation-skeleton-grid">
                              <div className="explanation-skeleton-card"></div>
                              <div className="explanation-skeleton-card"></div>
                              <div className="explanation-skeleton-card"></div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {fullData?.photoSummary && (
                              <p className="explanation-section__text">{fullData.photoSummary}</p>
                            )}
                            {hasFullAnalysisContent && (
                              <div className="explanation-brief-grid">
                                {Array.isArray(fullData?.observedClues) && fullData.observedClues.length > 0 && (
                                  <article className="explanation-brief-card">
                                    <h4 className="explanation-brief-card__title">
                                      {t('summary.photo_analysis_clues_title', {}, 'Repères visibles')}
                                    </h4>
                                    <ul className="explanation-brief-card__list">
                                      {fullData.observedClues.map((clue, index) => (
                                        <li key={`${clue}-${index}`} className="explanation-brief-card__list-item">
                                          {clue}
                                        </li>
                                      ))}
                                    </ul>
                                  </article>
                                )}
                                {fullData?.whyThisPhotoCouldMislead && (
                                  <article className="explanation-brief-card">
                                    <h4 className="explanation-brief-card__title">
                                      {t('summary.photo_analysis_mislead_title', {}, 'Ce qui a pu tromper')}
                                    </h4>
                                    <p className="explanation-brief-card__text">{fullData.whyThisPhotoCouldMislead}</p>
                                  </article>
                                )}
                                {fullData?.nextCheck && (
                                  <article className="explanation-brief-card">
                                    <h4 className="explanation-brief-card__title">
                                      {t('summary.photo_analysis_next_check_title', {}, 'Le détail à vérifier')}
                                    </h4>
                                    <p className="explanation-brief-card__text">{fullData.nextCheck}</p>
                                  </article>
                                )}
                                {fullData?.caution && (
                                  <article className="explanation-brief-card">
                                    <h4 className="explanation-brief-card__title">
                                      {t('summary.photo_analysis_caution_title', {}, 'Lecture prudente')}
                                    </h4>
                                    <p className="explanation-brief-card__text">{fullData.caution}</p>
                                  </article>
                                )}
                              </div>
                            )}
                            {hasFullAnalysisContent && fullConfidence !== 'unavailable' && (
                              <div
                                className="explanation-feedback-actions"
                                role="group"
                                aria-label={t('summary.explanation_feedback_label', {}, "Cette explication t'a aide ?")}
                              >
                                <button
                                  type="button"
                                  className={`explanation-feedback-btn ${explanationFeedback === true ? 'is-active' : ''}`}
                                  onClick={() => handleExplanationFeedback(true)}
                                  disabled={explanationFeedback !== null}
                                >
                                  {t('summary.explanation_feedback_yes', {}, 'Utile')}
                                </button>
                                <button
                                  type="button"
                                  className={`explanation-feedback-btn ${explanationFeedback === false ? 'is-active' : ''}`}
                                  onClick={() => handleExplanationFeedback(false)}
                                  disabled={explanationFeedback !== null}
                                >
                                  {t('summary.explanation_feedback_no', {}, 'Pas utile')}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </section>
                    )}

                    <section className="explanation-sources-panel">
                      <div className="explanation-sources-panel__summary">
                        <div className="explanation-sources-panel__copy">
                          <h4 className="explanation-sources-panel__title">
                            {t('summary.explanation_sources', {}, 'Sources utilisees')}
                          </h4>
                          <p className="explanation-sources-panel__meta">
                            {visibleSources.length > 0
                              ? [visibleSourceKindSummary, sourceProviders.join(' · ')].filter(Boolean).join(' · ')
                              : t('summary.sources_empty', {}, 'Aucune source detaillee disponible pour ce conseil.')}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="explanation-sources-toggle"
                          onClick={toggleSourcesExpanded}
                          disabled={visibleSources.length === 0}
                          aria-expanded={sourcesExpanded}
                        >
                          {sourceToggleLabel}
                        </button>
                      </div>

                      {sourcesExpanded && visibleSources.length > 0 && (
                        <div className="explanation-sources-list">
                          {visibleSources.map((source) => (
                            <article key={source.id} className="explanation-source-card">
                              <div className="explanation-source-card__header">
                                <div>
                                  <h5 className="explanation-source-card__title">{source.label}</h5>
                                  <p className="explanation-source-card__provider">
                                    {SOURCE_PROVIDER_LABELS[source.provider] || source.provider || SOURCE_PROVIDER_LABELS.unknown}
                                  </p>
                                </div>
                                <span className="explanation-source-card__kind">
                                  {renderSourceKind(source.kind)}
                                </span>
                              </div>
                              {source.snippet && (
                                <p className="explanation-source-card__snippet">{source.snippet}</p>
                              )}
                              <div className="explanation-source-card__footer">
                                {sourceCoverageById.get(source.id)?.length > 0 && (
                                  <p className="explanation-source-card__coverage">
                                    {sourceCoverageById.get(source.id).join(' · ')}
                                  </p>
                                )}
                                {source.url && (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="explanation-source-card__link"
                                  >
                                    {t('common.view', {}, 'Voir →')}
                                  </a>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="summary-footer">
          <button ref={buttonRef} onClick={onNext} className="btn btn--primary next-button">
            {t('common.next_question')}
          </button>
        </footer>
      </div>
    </BottomSheet>
  );
};

export default RoundSummaryModal;
