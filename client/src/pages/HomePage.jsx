import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import { useGeoDefaultPack, useDetectedRegion } from '../hooks/useGeoDefaultPack';
import { usePackPreviews } from '../hooks/usePackPreviews';
import { active_session } from '../services/db';
import { getReviewStats } from '../services/CollectionService';
import { notify } from '../services/notifications';
import AdvancedSettings from '../components/AdvancedSettings';
import CustomFilter from '../features/configurator/components/CustomFilter';
import PackIcon from '../components/PackIcons';
import { debugError, debugLog, debugWarn } from '../utils/logger';
import { getTodayDailySeed, isDailyCompleted, isDailySeedStale } from '../utils/dailyChallenge';
import '../features/configurator/Configurator.css';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const {
    startGame, resumeGame, clearSessionFromDB, startReviewMode,
    gameMode, setGameMode, activePackId, setActivePackId, maxQuestions, mediaType, setMediaType,
    customFilters, dispatchCustomFilters,
  } = useGameData();
  const { profile } = useUser();
  const { t } = useLanguage();
  const { packs, loading: packsLoading } = usePacks();
  const geoDefaultPack = useGeoDefaultPack();

  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);
  const [geoApplied, setGeoApplied] = useState(false);

  const todaySeed = getTodayDailySeed();
  const dailyAlreadyCompleted = isDailyCompleted(todaySeed);
  const hasPlayedGame = (profile?.stats?.gamesPlayed || 0) > 0;

  /* ── Auto-select geo-based pack for new players ── */
  useEffect(() => {
    if (geoApplied || packsLoading) return;
    if (!hasPlayedGame && activePackId === 'custom') {
      const packExists = packs.some((p) => p.id === geoDefaultPack);
      if (packExists) {
        debugLog('[HomePage] Auto-selecting geo pack:', geoDefaultPack);
        setActivePackId(geoDefaultPack);
      }
    }
    setGeoApplied(true);
  }, [geoApplied, packsLoading, hasPlayedGame, activePackId, packs, geoDefaultPack, setActivePackId]);

  /* ── Check for active session ── */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await active_session.get(1);
        if (session) {
          const sessionSeed = session.gameConfig?.dailySeed;
          if (sessionSeed && isDailySeedStale(sessionSeed)) {
            debugLog('[HomePage] Discarding stale daily session');
            await active_session.delete(1);
            setHasActiveSession(false);
            setResumeSessionData(null);
          } else {
            setHasActiveSession(true);
            setResumeSessionData(session);
          }
        } else {
          setHasActiveSession(false);
          setResumeSessionData(null);
        }
      } catch (err) {
        debugError('[HomePage] Error checking active session:', err);
        setHasActiveSession(false);
        setResumeSessionData(null);
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
    const handleVis = () => { if (document.visibilityState === 'visible') checkSession(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  /* ── Load review stats ── */
  useEffect(() => {
    let mounted = true;
    getReviewStats()
      .then((s) => mounted && setReviewStats(s))
      .catch((e) => debugError('[HomePage] review stats:', e));
    return () => { mounted = false; };
  }, []);

  /* ── Handlers ── */
  const handleStart = useCallback(() => {
    startGame({ maxQuestions, mediaType });
    navigate('/play');
  }, [navigate, startGame, maxQuestions, mediaType]);

  const handleResumeGame = useCallback(async () => {
    debugLog('[HomePage] Resuming game...');
    const data = await resumeGame();
    if (data) {
      await new Promise((r) => setTimeout(r, 100));
      navigate('/play');
    } else {
      debugWarn('[HomePage] No session data');
      notify(t?.resumeFailed || 'Impossible de reprendre la partie. La session a expiré.', {
        type: 'error',
        duration: 4000,
      });
    }
  }, [navigate, resumeGame]);

  const handleAbandonSession = useCallback(async () => {
    await clearSessionFromDB();
    setHasActiveSession(false);
  }, [clearSessionFromDB]);

  const handleDailyChallenge = useCallback(() => {
    if (isDailyCompleted(todaySeed)) return;
    if (hasActiveSession && resumeSessionData?.gameConfig?.dailySeed === todaySeed) {
      handleResumeGame();
      return;
    }
    startGame({ seed: todaySeed, seed_session: todaySeed, gameMode: 'hard', maxQuestions: 10 });
    navigate('/play');
  }, [navigate, startGame, todaySeed, hasActiveSession, resumeSessionData, handleResumeGame]);

  const handleStartReview = useCallback(async () => {
    const started = await startReviewMode();
    if (started) navigate('/play');
    return started;
  }, [navigate, startReviewMode]);

  const handlePackSelect = useCallback((packId) => {
    setActivePackId(packId);
  }, [setActivePackId]);

  const [customOpen, setCustomOpen] = useState(activePackId === 'custom');

  const handleModeChange = useCallback((mode) => {
    setGameMode(mode);
    if (mode === 'riddle') setMediaType('images');
  }, [setGameMode, setMediaType]);

  /* ── Derived ── */
  const detectedRegion = useDetectedRegion();
  const prefabPacks = packs.filter((p) => p.id !== 'custom');
  const activePack = packs.find((p) => p.id === activePackId);
  const activePackLabel = activePack?.titleKey ? t(activePack.titleKey) : activePackId;
  const modeName = gameMode === 'easy' ? t('home.easy_mode')
    : gameMode === 'hard' ? t('home.hard_mode')
    : gameMode === 'riddle' ? t('home.riddle_mode')
    : t('home.taxonomic_mode');
  const qLabel = maxQuestions ? `${maxQuestions} Q` : '∞';
  const isResuming = hasActiveSession && !isCheckingSession && resumeSessionData;

  /* ── Region-grouped packs (sorted by geo proximity) ── */
  const REGION_ORDER_DEFAULT = ['belgium', 'france', 'europe', 'world'];
  const regionGroupedPacks = useMemo(() => {
    if (packsLoading) return [];
    const order = [...REGION_ORDER_DEFAULT];
    const idx = order.indexOf(detectedRegion);
    if (idx > 0) { order.splice(idx, 1); order.unshift(detectedRegion); }
    const groups = {};
    for (const pack of prefabPacks) {
      const region = pack.region || 'world';
      if (!groups[region]) groups[region] = [];
      groups[region].push(pack);
    }
    return order.filter((r) => groups[r]?.length > 0).map((r) => ({
      region: r,
      label: t(`packs._regions.${r}`, {}, r),
      packs: groups[r],
    }));
  }, [packsLoading, prefabPacks, detectedRegion, t]);

  /* ── Pack preview images ── */
  const { getPhotos, loadPreview } = usePackPreviews();

  /* ── Hover description with delay ── */
  const hoverTimerRef = useRef(null);
  const [hoveredPackId, setHoveredPackId] = useState(null);
  const handlePackMouseEnter = useCallback((packId) => {
    loadPreview(packId);
    hoverTimerRef.current = setTimeout(() => setHoveredPackId(packId), 400);
  }, [loadPreview]);
  const handlePackMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredPackId(null);
  }, []);

  /* ── Loading ── */
  if (isCheckingSession) {
    return (
      <div className="screen home-screen">
        <div className="home-skeleton" aria-hidden="true">
          <div className="skeleton-block" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      </div>
    );
  }

  return (
    <div className="screen home-screen">
      {/* ═══════ HERO ZONE ═══════ */}
      <section className="home-hero">
        {isResuming ? (
          <div className="hero-cta-group">
            <button type="button" className="hero-cta hero-cta--resume" onClick={handleResumeGame}>
              <span className="hero-cta-label">{t('home.resume_game_button', {}, '▶ Reprendre')}</span>
              <span className="hero-cta-meta">
                {resumeSessionData.currentQuestionIndex > 0
                  ? t('home.resume_progress', { current: resumeSessionData.currentQuestionIndex, total: resumeSessionData.gameConfig?.maxQuestions || '∞' }, `Question ${resumeSessionData.currentQuestionIndex} sur ${resumeSessionData.gameConfig?.maxQuestions || '∞'}`)
                  : t('home.resume_game_subtitle', {}, 'Partie en cours')}
              </span>
            </button>
            <button type="button" className="hero-abandon" onClick={handleAbandonSession}
              title={t('home.abandon_session_tooltip', {}, 'Abandonner')}>
              ✕
            </button>
          </div>
        ) : (
          <button type="button" className="hero-cta hero-cta--play tutorial-hero-cta" onClick={handleStart} disabled={packsLoading}>
            <span className="hero-cta-label">{t('common.start_game', {}, '🎮 Jouer')}</span>
            <span className="hero-cta-meta">
              <PackIcon packId={activePackId} className="hero-cta-pack-icon" /> {activePackLabel} · {modeName} · {qLabel}
            </span>
          </button>
        )}

        {/* Quick-action chips */}
        <div className="home-chips">
          <button
            type="button"
            className={`home-chip ${dailyAlreadyCompleted ? 'done' : 'highlight'}`}
            onClick={handleDailyChallenge}
            disabled={dailyAlreadyCompleted}
          >
            <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></svg></span>
            <span className="chip-text">
              {dailyAlreadyCompleted
                ? t('home.daily_done_short', {}, 'Défi ✅')
                : t('home.daily_chip', {}, 'Défi du jour')}
            </span>
          </button>

          {reviewStats?.dueToday > 0 && (
            <button type="button" className="home-chip highlight" onClick={handleStartReview}>
              <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
              <span className="chip-text">{t('home.review_chip', {}, 'Révisions')}</span>
              <span className="chip-badge">{reviewStats.dueToday}</span>
            </button>
          )}
        </div>
      </section>

      {/* ═══════ MODE SELECTOR ═══════ */}
      <section className="home-mode">
        <div className="home-mode-row" role="radiogroup" aria-label={t('home.play_pillar_title', {}, 'Mode')}>
          <label className={`home-mode-chip ${gameMode === 'easy' ? 'active' : ''}`}>
            <input type="radio" name="home-mode" value="easy" checked={gameMode === 'easy'} onChange={() => handleModeChange('easy')} />
            <span className="mode-chip-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.25" />
              </svg>
            </span>
            <span>{t('home.easy_mode')}</span>
          </label>
          <label className={`home-mode-chip ${gameMode === 'hard' ? 'active' : ''}`}>
            <input type="radio" name="home-mode" value="hard" checked={gameMode === 'hard'} onChange={() => handleModeChange('hard')} />
            <span className="mode-chip-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <line x1="7" y1="10" x2="7" y2="14" strokeWidth="2" opacity="0.8" />
                <text x="10" y="14.5" fill="currentColor" stroke="none" fontSize="7" fontWeight="600" fontFamily="sans-serif" opacity="0.5">abc</text>
              </svg>
            </span>
            <span>{t('home.hard_mode')}</span>
          </label>
        </div>
      </section>

      {/* ═══════ PACK CATALOG — Netflix-style cards ═══════ */}
      <section className="home-packs">
        <p className="home-section-label">{t('home.pick_pack', {}, 'Choisis un pack')}</p>

        {packsLoading && (
          <div className="home-catalog-row">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="pack-card skeleton" key={`sk-${i}`} aria-hidden="true" />
            ))}
          </div>
        )}

        {!packsLoading && regionGroupedPacks.map(({ region, label, packs: regionPacks }) => (
          <PackRow
            key={region}
            label={label}
            packs={regionPacks}
            activePackId={activePackId}
            hoveredPackId={hoveredPackId}
            onSelect={(id) => { handlePackSelect(id); setCustomOpen(false); }}
            onMouseEnter={handlePackMouseEnter}
            onMouseLeave={handlePackMouseLeave}
            getPhotos={getPhotos}
            loadPreview={loadPreview}
            t={t}
          />
        ))}

        {/* Custom filter button */}
        {!packsLoading && (
          <button
            type="button"
            className={`pack-card pack-card--custom ${activePackId === 'custom' ? 'selected' : ''}`}
            onClick={() => { handlePackSelect('custom'); setCustomOpen(true); }}
            aria-pressed={activePackId === 'custom'}
          >
            <PackIcon packId="custom" className="pack-card-icon" />
            <span className="pack-card-title">{t('home.custom_filter_btn', {}, 'Personnalisé')}</span>
          </button>
        )}

        {/* ── Custom filter panel (collapsible) ── */}
        {customOpen && (
          <div className="home-custom-panel">
            <div className="home-custom-header">
              <p className="home-section-label">🎒 {t('home.custom_filter_btn', {}, 'Mode personnalisé')}</p>
              <button type="button" className="home-custom-close" onClick={() => setCustomOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <CustomFilter filters={customFilters} dispatch={dispatchCustomFilters} />
          </div>
        )}
      </section>

      {/* ═══════ ADVANCED SETTINGS ═══════ */}
      <AdvancedSettings />
    </div>
  );
};

/* ═══════ PACK ROW — Netflix-style horizontal scroll ═══════ */
function PackRow({ label, packs: regionPacks, activePackId, hoveredPackId, onSelect, onMouseEnter, onMouseLeave, getPhotos, loadPreview, t }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const dragState = useRef({ active: false, startX: 0, scrollStart: 0, moved: false });

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollProgress(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, [updateScroll, regionPacks]);

  // Preload preview images for visible packs
  useEffect(() => {
    regionPacks.forEach((p) => loadPreview(p.id));
  }, [regionPacks, loadPreview]);

  const scrollBy = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  }, []);

  /* ── Drag-to-scroll (pointer events) ── */
  const DRAG_THRESHOLD = 10; // px – must exceed this to count as a drag (not a click)

  const handlePointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { active: true, startX: e.clientX, scrollStart: el.scrollLeft, moved: false, pointerId: e.pointerId };
    // Don't capture yet — capture lazily once the user actually drags past the threshold
  }, []);

  const handlePointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const dx = e.clientX - ds.startX;
    if (!ds.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      ds.moved = true;
      const el = scrollRef.current;
      // Lazy capture: only now grab pointer and apply drag styling
      try { el.setPointerCapture(ds.pointerId); } catch (_) { /* ignore */ }
      el.style.cursor = 'grabbing';
      el.style.scrollSnapType = 'none';
    }
    if (ds.moved) {
      scrollRef.current.scrollLeft = ds.scrollStart - dx;
    }
  }, []);

  const handlePointerUp = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const el = scrollRef.current;
    ds.active = false;
    if (ds.moved) {
      try { el.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      el.style.cursor = '';
      el.style.scrollSnapType = '';
      // Suppress the click that follows a real drag
      const suppress = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', suppress, { capture: true, once: true });
    }
  }, []);

  // Dot count based on total scroll pages
  const dotCount = useMemo(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return 0;
    return Math.ceil(el.scrollWidth / el.clientWidth);
  }, [regionPacks]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDot = Math.min(Math.round(scrollProgress * (dotCount - 1)), dotCount - 1);

  return (
    <div className="home-pack-region">
      <div className="home-region-header">
        <p className="home-region-label">{label}</p>
        {dotCount > 1 && (
          <div className="home-region-dots">
            {Array.from({ length: dotCount }, (_, i) => (
              <span key={i} className={`region-dot ${i === activeDot ? 'active' : ''}`} />
            ))}
          </div>
        )}
      </div>
      <div className="home-catalog-row-wrapper">
        {canScrollLeft && (
          <div className="catalog-fade catalog-fade-left" />
        )}
        {canScrollLeft && (
          <button type="button" className="catalog-scroll-arrow catalog-scroll-left" onClick={() => scrollBy(-1)} aria-label="Défiler à gauche">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <div
          className="home-catalog-row"
          ref={scrollRef}
          role="list"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {regionPacks.map((pack) => {
            const selected = activePackId === pack.id;
            const photos = getPhotos(pack.id);
            const isHovered = hoveredPackId === pack.id;

            return (
              <button
                key={pack.id}
                type="button"
                className={`pack-card ${selected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => onSelect(pack.id)}
                onMouseEnter={() => onMouseEnter(pack.id)}
                onMouseLeave={onMouseLeave}
                onFocus={() => onMouseEnter(pack.id)}
                onBlur={onMouseLeave}
                aria-pressed={selected}
                role="listitem"
              >
                {/* 2×2 photo grid — fills entire card */}
                {photos && photos.length > 0 ? (
                  <div className="pack-card-photos">
                    {Array.from({ length: 4 }, (_, i) => {
                      const photo = photos[i % photos.length];
                      return (
                        <div key={i} className="pack-card-photo-cell">
                          <img src={photo.url} alt="" loading="lazy" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pack-card-photo-placeholder">
                    <PackIcon packId={pack.id} className="pack-card-icon-large" />
                  </div>
                )}

                {/* Always visible title strip */}
                <div className="pack-card-info">
                  <PackIcon packId={pack.id} className="pack-card-icon" />
                  <span className="pack-card-title">{t(pack.titleKey)}</span>
                </div>

                {/* Hover-expand description */}
                {isHovered && pack.descriptionKey && (
                  <div className="pack-card-desc">
                    <p>{t(pack.descriptionKey)}</p>
                  </div>
                )}

                {/* Selection indicator */}
                {selected && <div className="pack-card-check">✓</div>}
              </button>
            );
          })}
        </div>
        {canScrollRight && (
          <div className="catalog-fade catalog-fade-right" />
        )}
        {canScrollRight && (
          <button type="button" className="catalog-scroll-arrow catalog-scroll-right" onClick={() => scrollBy(1)} aria-label="Défiler à droite">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default HomePage;
