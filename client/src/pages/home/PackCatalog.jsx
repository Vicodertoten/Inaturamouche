import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PackIcon from '../../components/PackIcons';
import PackProgressBar from '../../components/PackProgressBar';
import { getPackEducationalWarningKey } from '../../utils/packWarnings';
import {
  PackSettingsIcon, DropdownChevronIcon, SaveIcon, ShareLinkIcon,
  MyPacksIcon, DeleteIcon, CheckIcon, WarningIndicatorIcon,
} from './HomeIcons';

const CustomFilter = lazy(() => import('../../features/configurator/components/CustomFilter'));

const DESKTOP_PACK_LIMIT = 6;

/**
 * PackCatalog — Netflix-style scrollable pack rows + custom filter.
 *
 * Pure presentational — all state & handlers come via props.
 */
function PackCatalog({
  isCatalogLoading,
  isDesktop,
  /* custom entry */
  customButtonRef,
  customPanelRef,
  activePackId,
  customOpen,
  handleCustomEntryClick,
  preloadCustomFilter,
  customEntryTitle,
  customEntryDescription,
  /* custom filter */
  customFilters,
  dispatchCustomFilters,
  showSaveInput,
  setShowSaveInput,
  savePackName,
  setSavePackName,
  handleSavePack,
  handleSharePack,
  /* saved packs */
  savedPacks,
  handleSelectSavedPack,
  handleDeleteSavedPack,
  pendingDeletePack,
  confirmDeletePack,
  cancelDeletePack,
  /* pack rows */
  visibleHomeSections,
  hoveredPackId,
  handlePackSelect,
  handlePackMouseEnter,
  handlePackMouseLeave,
  getPhotos,
  loadPreview,
  preloadPackPreviews,
  /* i18n */
  t,
}) {
  return (
    <section className="home-packs">
      <p className="home-section-label home-pick-pack-label">{t('home.pick_pack', {}, 'Choisis un pack')}</p>

      {/* Loading skeleton */}
      {isCatalogLoading && (
        <div className="home-catalog-row">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="pack-card skeleton" key={`sk-${i}`} aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Saved custom packs */}
      {!isCatalogLoading && savedPacks.length > 0 && (
        <div className="home-section">
          <p className="home-section-label home-section-label-icon"><MyPacksIcon /><span>{t('pack_share.my_packs', {}, 'Mes packs')}</span></p>
          <div className="home-catalog-row">
            {savedPacks.map((sp) => {
              const spPhotos = getPhotos(sp.id);
              return (
                <div key={sp.id} className="pack-card-shell">
                  <button
                    type="button"
                    className="pack-card pack-card--saved"
                    onClick={() => handleSelectSavedPack(sp)}
                  >
                    {spPhotos && spPhotos.length > 0 ? (
                      <div className="pack-card-photos">
                        {Array.from({ length: 4 }, (_, i) => {
                          const photo = spPhotos[i % spPhotos.length];
                          return (
                            <div key={i} className="pack-card-photo-cell">
                              <img src={photo.url} alt="" loading="lazy" decoding="async" className="pack-card-img" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pack-card-photo-placeholder pack-card-skeleton">
                        <PackIcon packId="custom" className="pack-card-icon-large" />
                      </div>
                    )}
                    <div className="pack-card-info">
                      <span className="pack-card-title">{sp.name}</span>
                    </div>
                    <span
                      className="pack-card-delete"
                      onClick={(e) => handleDeleteSavedPack(e, sp)}
                      role="button"
                      tabIndex={0}
                      aria-label={t('pack_share.delete', {}, 'Supprimer')}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteSavedPack(e, sp); }}
                    >
                      <DeleteIcon />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {pendingDeletePack && (
        <div className="delete-confirm-overlay" onClick={cancelDeletePack}>
          <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="delete-confirm-text">
              {t('pack_share.delete_confirm', { name: pendingDeletePack.name }, `Supprimer « ${pendingDeletePack.name} » ?`)}
            </p>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn--outline btn--sm" onClick={cancelDeletePack}>
                {t('common.cancel', {}, 'Annuler')}
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={confirmDeletePack}>
                {t('pack_share.delete', {}, 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pack rows by section */}
      {!isCatalogLoading && visibleHomeSections.map((section) => (
        <PackRow
          key={section.id}
          label={t(section.titleKey, {}, section.id)}
          packs={section.packs}
          activePackId={activePackId}
          hoveredPackId={hoveredPackId}
          onSelect={(id) => { handlePackSelect(id); }}
          onMouseEnter={handlePackMouseEnter}
          onMouseLeave={handlePackMouseLeave}
          getPhotos={getPhotos}
          loadPreview={loadPreview}
          preloadPackPreviews={preloadPackPreviews}
          isDesktop={isDesktop}
          maxDesktopCards={DESKTOP_PACK_LIMIT}
          t={t}
        />
      ))}

      {/* Custom entry card — placed after pack rows */}
      {!isCatalogLoading && (
        <div className="home-custom-entry">
          <button
            type="button"
            ref={customButtonRef}
            className={`home-custom-card ${activePackId === 'custom' ? 'active' : ''} ${customOpen ? 'open' : ''}`}
            onMouseEnter={preloadCustomFilter}
            onFocus={preloadCustomFilter}
            onTouchStart={preloadCustomFilter}
            onClick={handleCustomEntryClick}
            aria-pressed={activePackId === 'custom'}
            aria-expanded={customOpen}
            aria-controls="home-custom-panel"
            aria-haspopup="menu"
          >
            <span className="home-custom-card-icon" aria-hidden="true">
              <PackIcon packId="custom" className="pack-card-icon" />
            </span>
            <span className="home-custom-card-copy">
              <span className="home-custom-card-title">{customEntryTitle}</span>
              <span className="home-custom-card-subtitle">{customEntryDescription}</span>
            </span>
            <span className="home-custom-card-chevron" aria-hidden="true">
              <DropdownChevronIcon />
            </span>
          </button>
        </div>
      )}

      {/* Custom filter panel (collapsible) */}
      {customOpen && (
        <div className="home-custom-panel" id="home-custom-panel" ref={customPanelRef}>
          <div className="home-custom-header">
            <p className="home-section-label home-section-label-icon">
              <PackSettingsIcon />
              <span>{customEntryTitle}</span>
            </p>
          </div>
          <Suspense
            fallback={
              <p className="custom-filter-description">
                {t('home.custom_filter_loading', {}, 'Chargement des filtres...')}
              </p>
            }
          >
            <CustomFilter filters={customFilters} dispatch={dispatchCustomFilters} />
          </Suspense>

          {/* Save / Share custom pack */}
          <div className="custom-pack-actions">
            {!showSaveInput ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setShowSaveInput(true)}
              >
                <SaveIcon /> {t('pack_share.save_btn', {}, 'Sauvegarder')}
              </button>
            ) : (
              <div className="save-pack-row">
                <input
                  type="text"
                  className="save-pack-input"
                  placeholder={t('pack_share.name_placeholder', {}, 'Nom du pack…')}
                  value={savePackName}
                  onChange={(e) => setSavePackName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePack();
                    if (e.key === 'Escape') setShowSaveInput(false);
                  }}
                />
                <button type="button" className="btn btn--primary btn--sm" onClick={handleSavePack} disabled={!savePackName.trim()}>
                  <CheckIcon />
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowSaveInput(false)}>
                  <DeleteIcon />
                </button>
              </div>
            )}
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={handleSharePack}
            >
              <ShareLinkIcon /> {t('pack_share.share_btn', {}, 'Partager')}
            </button>
          </div>
        </div>
      )}

      {!isDesktop && (
        <p className="home-pack-warning-legend">
          <span className="home-pack-warning-pill" aria-hidden="true">
            <WarningIndicatorIcon className="home-pack-warning-icon" />
          </span>
          <span className="home-pack-warning-text">
            {t(
              'home.educational_indicator_help',
              {},
              'Icone: contenu educatif uniquement, pas un guide de cueillette, de consommation ou d usage medical.'
            )}
          </span>
        </p>
      )}
    </section>
  );
}

/* ═══════ PACK ROW — horizontal scroll with desktop cap ═══════ */
function PackRow({
  label,
  packs: sourcePacks,
  activePackId,
  hoveredPackId,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  getPhotos,
  loadPreview,
  preloadPackPreviews,
  isDesktop,
  maxDesktopCards = DESKTOP_PACK_LIMIT,
  t,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const dragState = useRef({ active: false, startX: 0, scrollStart: 0, moved: false });
  const PRELOAD_BUFFER_CARDS = 2;
  const FALLBACK_CARD_WIDTH = 140;
  const [desktopVisibleCount, setDesktopVisibleCount] = useState(maxDesktopCards);
  const hasDesktopOverflow = isDesktop && sourcePacks.length > maxDesktopCards;
  const hasDesktopMore = isDesktop && sourcePacks.length > desktopVisibleCount;
  const desktopRemainingCount = Math.max(0, sourcePacks.length - desktopVisibleCount);
  const visiblePacks = useMemo(
    () => (isDesktop ? sourcePacks.slice(0, desktopVisibleCount) : sourcePacks),
    [desktopVisibleCount, isDesktop, sourcePacks]
  );

  useEffect(() => {
    setDesktopVisibleCount(maxDesktopCards);
  }, [isDesktop, maxDesktopCards, sourcePacks]);

  useEffect(() => {
    if (!isDesktop) return;
    const visibleIds = visiblePacks
      .map((pack) => pack?.id)
      .filter(Boolean);
    for (const packId of visibleIds) {
      loadPreview(packId);
    }

    const nextIds = sourcePacks
      .slice(desktopVisibleCount, desktopVisibleCount + maxDesktopCards)
      .map((pack) => pack?.id)
      .filter(Boolean);
    if (nextIds.length > 0) {
      preloadPackPreviews(nextIds);
    }
  }, [
    desktopVisibleCount,
    isDesktop,
    loadPreview,
    maxDesktopCards,
    preloadPackPreviews,
    sourcePacks,
    visiblePacks,
  ]);

  const handleSeeMore = useCallback(() => {
    if (!hasDesktopOverflow) return;
    if (hasDesktopMore) {
      setDesktopVisibleCount((current) => Math.min(sourcePacks.length, current + maxDesktopCards));
      return;
    }
    setDesktopVisibleCount(maxDesktopCards);
  }, [hasDesktopMore, hasDesktopOverflow, maxDesktopCards, sourcePacks.length]);

  const updateScroll = useCallback(() => {
    if (isDesktop) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      setScrollProgress(0);
      return;
    }

    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollProgress(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);

    const firstCard = el.firstElementChild;
    const measuredWidth = firstCard ? (firstCard.getBoundingClientRect().width || 0) : 0;
    const cardWidth = measuredWidth > 0 ? measuredWidth + 10 : FALLBACK_CARD_WIDTH;
    const startIndex = Math.max(0, Math.floor(el.scrollLeft / cardWidth) - PRELOAD_BUFFER_CARDS);
    const visibleCount = Math.max(1, Math.ceil(el.clientWidth / cardWidth));
    const endIndex = Math.min(
      sourcePacks.length,
      startIndex + visibleCount + PRELOAD_BUFFER_CARDS * 2
    );
    for (let i = startIndex; i < endIndex; i += 1) {
      const packId = sourcePacks[i]?.id;
      if (packId) loadPreview(packId);
    }
  }, [isDesktop, sourcePacks, loadPreview]);

  useEffect(() => {
    if (isDesktop) return undefined;
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, [isDesktop, updateScroll, sourcePacks]);

  const scrollBy = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  }, []);

  /* ── Drag-to-scroll (pointer events) ── */
  const DRAG_THRESHOLD = 10;

  const handlePointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { active: true, startX: e.clientX, scrollStart: el.scrollLeft, moved: false, pointerId: e.pointerId };
  }, []);

  const handlePointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const dx = e.clientX - ds.startX;
    if (!ds.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      ds.moved = true;
      const el = scrollRef.current;
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
      const suppress = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', suppress, { capture: true, once: true });
    }
  }, []);

  const dotCount = useMemo(() => {
    if (isDesktop) return 0;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return 0;
    return Math.ceil(el.scrollWidth / el.clientWidth);
  }, [isDesktop, sourcePacks]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDot = dotCount > 0
    ? Math.min(Math.round(scrollProgress * (dotCount - 1)), dotCount - 1)
    : 0;

  const [pulsedPackId, setPulsedPackId] = useState(null);
  const pulseRafRef = useRef(null);

  const triggerPackSelectPulse = useCallback((packId) => {
    if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
    setPulsedPackId(null);
    pulseRafRef.current = requestAnimationFrame(() => {
      setPulsedPackId(packId);
      pulseRafRef.current = null;
    });
  }, []);

  useEffect(() => () => {
    if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
  }, []);

  useEffect(() => {
    if (!pulsedPackId) return undefined;
    const timer = setTimeout(() => setPulsedPackId(null), 520);
    return () => clearTimeout(timer);
  }, [pulsedPackId]);

  const renderPackCard = (pack) => {
    const selected = activePackId === pack.id;
    const photos = getPhotos(pack.id);
    const isHovered = hoveredPackId === pack.id;
    const warningKey = getPackEducationalWarningKey(pack);
    const packTitle = pack.titleKey ? t(pack.titleKey) : pack.id;
    const mobileAttentionLabel = t('home.educational_indicator_label', {}, 'Avertissement');

    return (
      <div
        key={pack.id}
        className={`pack-card-shell ${isHovered ? 'hovered' : ''} ${pulsedPackId === pack.id ? 'pack-card-shell--select-pulse' : ''}`}
      >
        <button
          data-pack-id={pack.id}
          type="button"
          className={`pack-card ${selected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${pulsedPackId === pack.id ? 'pack-card--select-pulse' : ''}`}
          onClick={() => {
            triggerPackSelectPulse(pack.id);
            onSelect(pack.id);
          }}
          onMouseEnter={() => onMouseEnter(pack.id)}
          onMouseLeave={onMouseLeave}
          onFocus={() => onMouseEnter(pack.id)}
          onBlur={onMouseLeave}
          aria-pressed={selected}
          aria-label={!isDesktop && warningKey ? `${packTitle} - ${mobileAttentionLabel}` : packTitle}
          role="listitem"
        >
          {photos && photos.length > 0 ? (
            <div className="pack-card-photos">
              {Array.from({ length: 4 }, (_, i) => {
                const photo = photos[i % photos.length];
                return (
                  <div key={i} className="pack-card-photo-cell">
                    <img src={photo.url} alt="" loading="lazy" decoding="async" className="pack-card-img" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pack-card-photo-placeholder pack-card-skeleton">
              <PackIcon packId={pack.id} className="pack-card-icon-large" />
            </div>
          )}

          {!isDesktop && warningKey && (
            <span className="pack-card-attention-indicator" aria-hidden="true">
              <WarningIndicatorIcon className="pack-card-attention-icon" />
            </span>
          )}

          <div className="pack-card-info">
            <span className="pack-card-title">{packTitle}</span>
            {Array.isArray(pack.taxa_ids) && pack.taxa_ids.length > 0 && (
              <PackProgressBar taxaIds={pack.taxa_ids} compact />
            )}
          </div>

          {isDesktop && isHovered && pack.descriptionKey && (
            <div className="pack-card-desc">
              <p className="pack-card-desc-title">{packTitle}</p>
              <p className="pack-card-desc-body">{t(pack.descriptionKey)}</p>
            </div>
          )}
        </button>
        {isDesktop && isHovered && warningKey && (
          <div className="pack-card-warning-bubble" role="note" aria-label={t(warningKey)}>
            <p>{t(warningKey)}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="home-pack-region">
      <div className="home-region-header">
        <div className="home-region-header-main">
          <p className="home-region-label">{label}</p>
          {!isDesktop && dotCount > 1 && (
            <div className="home-region-dots">
              {Array.from({ length: dotCount }, (_, i) => (
                <span key={i} className={`region-dot ${i === activeDot ? 'active' : ''}`} />
              ))}
            </div>
          )}
        </div>
      </div>
      {isDesktop ? (
        <div className="home-catalog-grid" role="list">
          {visiblePacks.map(renderPackCard)}
        </div>
      ) : (
        <div className="home-catalog-row-wrapper">
          {canScrollLeft && <div className="catalog-fade catalog-fade-left" />}
          {canScrollLeft && (
            <button type="button" className="catalog-scroll-arrow catalog-scroll-left" onClick={() => scrollBy(-1)} aria-label="Défiler à gauche">
              <span className="catalog-scroll-glyph" aria-hidden="true">‹</span>
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
            {visiblePacks.map(renderPackCard)}
          </div>
          {canScrollRight && <div className="catalog-fade catalog-fade-right" />}
          {canScrollRight && (
            <button type="button" className="catalog-scroll-arrow catalog-scroll-right" onClick={() => scrollBy(1)} aria-label="Défiler à droite">
              <span className="catalog-scroll-glyph" aria-hidden="true">›</span>
            </button>
          )}
        </div>
      )}
      {hasDesktopOverflow && (
        <div className="home-region-footer">
          <button type="button" className="home-region-see-more" onClick={handleSeeMore}>
            {hasDesktopMore
              ? `${t('home.see_more_packs', {}, 'Voir plus')} (${desktopRemainingCount})`
              : t('home.see_less_packs', {}, 'Voir moins')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(PackCatalog);
