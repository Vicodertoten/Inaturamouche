import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useLanguage } from '../context/LanguageContext.jsx';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];

const RANK_COLORS = {
  kingdom: '#7abf66',
  phylum: '#8fb1e3',
  class: '#e0aaff',
  order: '#f2c14f',
  family: '#f4978e',
  genus: '#6dd3c3',
  species: '#5ac46a',
};

const buildLinearTree = (nodes, rootLabel) => {
  const root = { name: rootLabel, label: rootLabel, rank: 'root', known: true, children: [] };
  let cursor = root;
  nodes.forEach((node) => {
    const next = { ...node, children: [] };
    cursor.children = [next];
    cursor = next;
  });
  return root;
};

function PhylogeneticTree({ knownTaxa = {}, targetTaxon, activeRank }) {
  const svgRef = useRef(null);
  const scrollRef = useRef(null);
  const cardRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const hoverStateRef = useRef({ nodeHovered: false, cardHovered: false });
  const wikiCacheRef = useRef({});
  const wikiInFlightRef = useRef(new Set());
  const [hoveredNode, setHoveredNode] = useState(null);
  const [cardPosition, setCardPosition] = useState({ left: 0, top: 0 });
  const [wikiCache, setWikiCache] = useState({});
  const { t, getTaxonDisplayNames, language } = useLanguage();

  const wikiLanguage = useMemo(() => {
    if (language === 'fr' || language === 'en' || language === 'nl') return language;
    return 'fr';
  }, [language]);

  const lineageByRank = useMemo(() => {
    if (!targetTaxon) return {};
    const map = {};
    RANKS.forEach((rank) => {
      if (rank === 'species') {
        map[rank] = targetTaxon;
        return;
      }
      const match = targetTaxon?.ancestors?.find((a) => a.rank === rank);
      if (match) map[rank] = match;
    });
    return map;
  }, [targetTaxon]);

  const { treeRoot, nodeByRank } = useMemo(() => {
    const rankLabels = RANKS.reduce((acc, rank) => {
      acc[rank] = t(`ranks.${rank}`);
      return acc;
    }, {});

    const nodes = RANKS.map((rank) => {
      const knownEntry = knownTaxa?.[rank];
      const taxon = knownEntry?.taxon || lineageByRank[rank];
      const { primary, secondary } = knownEntry ? getTaxonDisplayNames(knownEntry.taxon) : { primary: '', secondary: '' };
      const displayName = knownEntry ? primary : rankLabels[rank] || rank;
      const wikiTitle =
        taxon?.name || taxon?.preferred_common_name || taxon?.common_name || taxon?.commonName || '';
      const wikiKey = wikiTitle ? `${wikiLanguage}:${wikiTitle}` : null;

      return {
        rank,
        known: Boolean(knownEntry),
        discovered: Boolean(knownEntry),
        label: displayName,
        secondary: knownEntry ? secondary : '',
        taxon,
        isActive: activeRank === rank,
        rankLabel: rankLabels[rank] || rank,
        wikiTitle,
        wikiKey,
        wikiLanguage,
      };
    });

    const rootLabel = t('hard.phylo.root', {}, 'Vie');
    const nodeByRank = nodes.reduce((acc, node) => {
      acc[node.rank] = node;
      return acc;
    }, {});
    return { treeRoot: buildLinearTree(nodes, rootLabel), nodeByRank };
  }, [activeRank, getTaxonDisplayNames, knownTaxa, lineageByRank, t, wikiLanguage]);

  const hoveredNodeData = hoveredNode ? nodeByRank[hoveredNode.rank] : null;
  const hoveredWikiEntry = hoveredNodeData?.wikiKey ? wikiCache[hoveredNodeData.wikiKey] : null;

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    let rootGroup = svg.select('g.graph-root');
    if (rootGroup.empty()) {
      rootGroup = svg.append('g').attr('class', 'graph-root');
      rootGroup.append('g').attr('class', 'links-layer');
      rootGroup.append('g').attr('class', 'nodes-layer');
    }
    const linksLayer = rootGroup.select('g.links-layer');
    const nodesLayer = rootGroup.select('g.nodes-layer');

    const verticalSpacing = 26;
    const margin = { top: 8, right: 64, bottom: 8, left: 62 };
    const labelOffset = 12;

    const layout = d3.tree().nodeSize([54, verticalSpacing]);
    const hierarchyRoot = d3.hierarchy(treeRoot);
    layout(hierarchyRoot);

    const visibleNodes = hierarchyRoot.descendants().filter((d) => d.depth > 0);
    const x0 = d3.min(visibleNodes, (d) => d.x) ?? 0;
    const x1 = d3.max(visibleNodes, (d) => d.x) ?? 0;
    const y1 = d3.max(hierarchyRoot.descendants(), (d) => d.y) ?? 0;
    const longestLabel = d3.max(visibleNodes, (d) => {
      const labelLength = d.data.label ? d.data.label.length : 0;
      const secondaryLength = d.data.secondary ? Math.min(24, d.data.secondary.length) * 0.6 : 0;
      return labelLength + secondaryLength;
    }) || 0;
    const labelColumn = Math.max(118, Math.min(180, longestLabel * 3.9 + 18));

    const height = y1 + margin.top + margin.bottom + 2;
    const width = x1 - x0 + margin.left + margin.right + labelColumn;
    svg.attr('viewBox', [0, 0, Math.max(width, 280), Math.max(height, 140)].join(' '));

    const linkGen = d3
      .linkVertical()
      .x((d) => d.x - x0 + margin.left)
      .y((d) => d.y + margin.top);

    const linksData = hierarchyRoot.links().filter((d) => d.target.depth > 0);
    const links = linksLayer.selectAll('path.phylo-link').data(linksData, (d) => d.target.data.rank || d.target.data.name);

    const linkEnter = links
      .enter()
      .append('path')
      .attr('class', 'phylo-link')
      .attr('d', (d) =>
        linkGen({
          source: { x: d.target.x, y: d.target.y },
          target: { x: d.target.x, y: d.target.y },
        })
      );

    linkEnter
      .merge(links)
      .transition()
      .duration(500)
      .attr('d', (d) =>
        linkGen({
          source: { x: d.source.x, y: d.source.y },
          target: { x: d.target.x, y: d.target.y },
        })
      );

    links.exit().transition().duration(200).style('opacity', 0).remove();

    const nodes = nodesLayer.selectAll('g.phylo-node').data(visibleNodes, (d) => d.data.rank || d.data.name);

    const nodeEnter = nodes
      .enter()
      .append('g')
      .attr('class', (d) => `phylo-node ${d.data.known ? 'known' : 'unknown'} ${d.data.isActive ? 'active' : ''}`)
      .attr('transform', (d) => `translate(${d.parent ? d.parent.x - x0 + margin.left : margin.left}, ${d.parent ? d.parent.y + margin.top : margin.top})`);

    nodeEnter
      .append('circle')
      .attr('r', 6.2)
      .attr('fill', (d) => (d.data.known ? RANK_COLORS[d.data.rank] || 'var(--primary-color)' : 'transparent'))
      .attr('stroke', (d) => (d.data.known ? RANK_COLORS[d.data.rank] || 'var(--primary-color)' : 'var(--border-color)'))
      .attr('stroke-width', (d) => (d.data.isActive ? 3 : 2))
      .attr('stroke-dasharray', (d) => (d.data.known ? null : '5 4'));

    nodeEnter
      .append('text')
      .attr('class', 'node-locked')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .text((d) => (d.data.known ? '' : '?'));

    nodeEnter
      .append('text')
      .attr('dy', -2)
      .attr('x', labelOffset)
      .attr('text-anchor', 'start')
      .attr('class', 'node-label')
      .text((d) => d.data.label);

    nodeEnter
      .append('text')
      .attr('dy', 7)
      .attr('x', labelOffset)
      .attr('text-anchor', 'start')
      .attr('class', 'node-secondary')
      .text((d) => (d.data.secondary ? d.data.secondary : ''));

    const nodeUpdate = nodes
      .merge(nodeEnter)
      .attr('class', (d) => `phylo-node ${d.data.known ? 'known' : 'unknown'} ${d.data.isActive ? 'active' : ''}`)
      .transition()
      .duration(450)
      .attr('transform', (d) => `translate(${d.x - x0 + margin.left}, ${d.y + margin.top})`);

    nodeUpdate
      .select('circle')
      .attr('fill', (d) => (d.data.known ? RANK_COLORS[d.data.rank] || 'var(--primary-color)' : 'transparent'))
      .attr('stroke', (d) => (d.data.known ? RANK_COLORS[d.data.rank] || 'var(--primary-color)' : 'var(--border-color)'))
      .attr('stroke-width', (d) => (d.data.isActive ? 3 : 2))
      .attr('stroke-dasharray', (d) => (d.data.known ? null : '5 4'));

    nodeUpdate
      .select('text.node-locked')
      .text((d) => (d.data.known ? '' : '?'))
      .style('opacity', (d) => (d.data.known ? 0 : 1));

    nodeUpdate.select('text.node-label').attr('x', labelOffset).text((d) => d.data.label);
    nodeUpdate
      .select('text.node-secondary')
      .attr('x', labelOffset)
      .attr('dy', 7)
      .text((d) => (d.data.secondary ? d.data.secondary : ''));

    nodes
      .exit()
      .transition()
      .duration(250)
      .style('opacity', 0)
      .remove();

    const clearHoverTimers = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const scheduleHide = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        if (!hoverStateRef.current.nodeHovered && !hoverStateRef.current.cardHovered) {
          setHoveredNode(null);
        }
      }, 140);
    };

    const scheduleShow = (event, d) => {
      const containerEl = scrollRef.current;
      if (!containerEl || !event.currentTarget || !d?.data?.rank) return;

      const containerRect = containerEl.getBoundingClientRect();
      const nodeRect = event.currentTarget.getBoundingClientRect();
      const anchorX = nodeRect.left - containerRect.left + containerEl.scrollLeft + nodeRect.width / 2;
      const anchorY = nodeRect.top - containerRect.top + containerEl.scrollTop + nodeRect.height / 2;

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      hoverTimerRef.current = setTimeout(() => {
        setHoveredNode({ rank: d.data.rank, anchorX, anchorY });
      }, 200);
    };

    nodes
      .merge(nodeEnter)
      .on('mouseenter', (event, d) => {
        hoverStateRef.current.nodeHovered = true;
        scheduleShow(event, d);
      })
      .on('mouseleave', () => {
        hoverStateRef.current.nodeHovered = false;
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        scheduleHide();
      })
      .style('cursor', (d) => (d.data.known ? 'pointer' : 'default'))
      .on('click', null);

    return () => {
      clearHoverTimers();
    };
  }, [treeRoot]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setHoveredNode(null);
  }, [targetTaxon]);

  useEffect(() => {
    if (!hoveredNodeData?.discovered || !hoveredNodeData?.wikiTitle || !hoveredNodeData?.wikiKey) return;
    const wikiKey = hoveredNodeData.wikiKey;
    const inFlight = wikiInFlightRef.current;
    const cachedEntry = wikiCacheRef.current[wikiKey];
    if (cachedEntry?.status === 'loaded' || cachedEntry?.status === 'error') return;
    if (inFlight.has(wikiKey)) return;

    inFlight.add(wikiKey);
    setWikiCache((prev) => {
      const next = { ...prev, [wikiKey]: { status: 'loading', title: hoveredNodeData.wikiTitle } };
      wikiCacheRef.current = next;
      return next;
    });

    const controller = new AbortController();
    let cancelled = false;
    const wikiBase = `https://${hoveredNodeData.wikiLanguage}.wikipedia.org/api/rest_v1/page/summary/`;
    const wikiTitle = encodeURIComponent(hoveredNodeData.wikiTitle.replace(/ /g, '_'));
    const wikiUrl = `${wikiBase}${wikiTitle}`;

    fetch(wikiUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('wiki_fetch_failed');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const summary = typeof data?.extract === 'string' ? data.extract.trim() : '';
        if (!summary) {
          setWikiCache((prev) => {
            const next = { ...prev, [wikiKey]: { status: 'error' } };
            wikiCacheRef.current = next;
            return next;
          });
          return;
        }
        const truncated = summary.length > 120 ? `${summary.slice(0, 120)}…` : summary;
        const pageUrl =
          data?.content_urls?.desktop?.page ||
          data?.content_urls?.mobile?.page ||
          data?.content_urls?.canonical ||
          null;
        setWikiCache((prev) => {
          const next = {
            ...prev,
            [wikiKey]: {
              status: 'loaded',
              summary: truncated,
              title: data?.title || hoveredNodeData.wikiTitle,
              url: pageUrl,
            },
          };
          wikiCacheRef.current = next;
          return next;
        });
      })
      .catch((error) => {
        if (cancelled || error?.name === 'AbortError') return;
        setWikiCache((prev) => {
          const next = { ...prev, [wikiKey]: { status: 'error' } };
          wikiCacheRef.current = next;
          return next;
        });
      })
      .finally(() => {
        inFlight.delete(wikiKey);
      });

    return () => {
      cancelled = true;
      controller.abort();
      inFlight.delete(wikiKey);
    };
  }, [hoveredNodeData]);

  useLayoutEffect(() => {
    if (!hoveredNode || !hoveredNodeData || !cardRef.current || !scrollRef.current) return;
    const containerEl = scrollRef.current;
    const cardRect = cardRef.current.getBoundingClientRect();
    const gap = 12;
    const scrollLeft = containerEl.scrollLeft;
    const scrollTop = containerEl.scrollTop;
    const visibleLeft = scrollLeft + gap;
    const visibleRight = scrollLeft + containerEl.clientWidth - gap;
    const visibleTop = scrollTop + gap;
    const visibleBottom = scrollTop + containerEl.clientHeight - gap;

    let left = hoveredNode.anchorX + gap;
    let top = hoveredNode.anchorY - cardRect.height / 2;

    if (left + cardRect.width > visibleRight) {
      left = hoveredNode.anchorX - cardRect.width - gap;
    }
    if (left < visibleLeft) left = visibleLeft;
    if (top < visibleTop) top = visibleTop;
    if (top + cardRect.height > visibleBottom) {
      top = visibleBottom - cardRect.height;
    }

    setCardPosition({ left, top });
  }, [hoveredNode, hoveredNodeData, hoveredWikiEntry]);

  const handleCardEnter = () => {
    hoverStateRef.current.cardHovered = true;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleCardLeave = () => {
    hoverStateRef.current.cardHovered = false;
    if (!hoverStateRef.current.nodeHovered) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        if (!hoverStateRef.current.nodeHovered && !hoverStateRef.current.cardHovered) {
          setHoveredNode(null);
        }
      }, 140);
    }
  };

  const isDiscovered = hoveredNodeData?.discovered;
  const wikiUrl = hoveredWikiEntry?.url || hoveredNodeData?.taxon?.wikipedia_url || null;
  const summaryText = (() => {
    if (!isDiscovered) return '';
    if (!hoveredWikiEntry || hoveredWikiEntry.status === 'loading') {
      return t('common.loading', {}, 'Chargement...');
    }
    if (hoveredWikiEntry.status === 'loaded' && hoveredWikiEntry.summary) {
      return hoveredWikiEntry.summary;
    }
    return t('hard.phylo.unavailable', {}, 'Informations non disponibles');
  })();

  const cardContent = hoveredNodeData ? (
    isDiscovered ? (
      <>
        <div className="phylo-card-rank">{hoveredNodeData.rankLabel}</div>
        <div className="phylo-card-name">{hoveredNodeData.label}</div>
        {hoveredNodeData.secondary ? <div className="phylo-card-secondary">{hoveredNodeData.secondary}</div> : null}
        <div className="phylo-card-summary">{summaryText}</div>
        {wikiUrl ? <div className="phylo-card-link">{t('hard.phylo.more', {}, 'Ouvrir Wikipédia')}</div> : null}
      </>
    ) : (
      <div className="phylo-card-unknown">?</div>
    )
  ) : null;

  return (
    <div className="phylo-tree-shell">
      <div className="phylo-scroll" ref={scrollRef}>
        <svg ref={svgRef} className="phylo-svg" role="img" aria-label={t('hard.phylo.title', {}, 'Arbre phylogénétique')}></svg>
        {hoveredNodeData && hoveredNode ? (
          wikiUrl && isDiscovered ? (
            <a
              className={`phylo-card ${isDiscovered ? 'discovered' : 'unknown'}`}
              href={wikiUrl}
              target="_blank"
              rel="noreferrer"
              ref={cardRef}
              style={{ left: `${cardPosition.left}px`, top: `${cardPosition.top}px` }}
              onMouseEnter={handleCardEnter}
              onMouseLeave={handleCardLeave}
            >
              {cardContent}
            </a>
          ) : (
            <div
              className={`phylo-card ${isDiscovered ? 'discovered' : 'unknown'}`}
              ref={cardRef}
              style={{ left: `${cardPosition.left}px`, top: `${cardPosition.top}px` }}
              onMouseEnter={handleCardEnter}
              onMouseLeave={handleCardLeave}
            >
              {cardContent}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

const areTreePropsEqual = (prev, next) => {
  if (prev.activeRank !== next.activeRank) return false;
  const prevTarget = prev.targetTaxon;
  const nextTarget = next.targetTaxon;
  if ((prevTarget?.id ?? null) !== (nextTarget?.id ?? null)) return false;
  const prevAncestors = prevTarget?.ancestors || [];
  const nextAncestors = nextTarget?.ancestors || [];
  if (prevAncestors.length !== nextAncestors.length) return false;
  for (let i = 0; i < prevAncestors.length; i++) {
    if (prevAncestors[i]?.id !== nextAncestors[i]?.id) return false;
  }
  for (const rank of RANKS) {
    const prevId = prev.knownTaxa?.[rank]?.taxon?.id ?? prev.knownTaxa?.[rank]?.id ?? null;
    const nextId = next.knownTaxa?.[rank]?.taxon?.id ?? next.knownTaxa?.[rank]?.id ?? null;
    if (prevId !== nextId) return false;
  }
  return true;
};

export default React.memo(PhylogeneticTree, areTreePropsEqual);
