import React, { useEffect, useMemo, useRef } from 'react';
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
  const tooltipRef = useRef(null);
  const { t, getTaxonDisplayNames } = useLanguage();

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

  const treeData = useMemo(() => {
    const rankLabels = RANKS.reduce((acc, rank) => {
      acc[rank] = t(`ranks.${rank}`);
      return acc;
    }, {});

    const nodes = RANKS.map((rank) => {
      const knownEntry = knownTaxa?.[rank];
      const taxon = knownEntry?.taxon || lineageByRank[rank];
      const { primary, secondary } = knownEntry ? getTaxonDisplayNames(knownEntry.taxon) : { primary: '', secondary: '' };
      const displayName = knownEntry ? primary : rankLabels[rank] || rank;

      return {
        rank,
        known: Boolean(knownEntry),
        label: displayName,
        secondary: knownEntry ? secondary : '',
        taxon,
        isActive: activeRank === rank,
        wikiUrl: taxon?.wikipedia_url || (taxon?.id ? `https://www.inaturalist.org/taxa/${taxon.id}` : null),
      };
    });

    const rootLabel = t('hard.phylo.root', {}, 'Vie');
    return buildLinearTree(nodes, rootLabel);
  }, [activeRank, getTaxonDisplayNames, knownTaxa, lineageByRank, t]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    let tooltipSel = tooltipRef.current ? d3.select(tooltipRef.current) : null;
    if (!tooltipSel) {
      tooltipSel = d3
        .select('body')
        .append('div')
        .attr('class', 'phylo-tooltip')
        .style('opacity', 0);
      tooltipRef.current = tooltipSel.node();
    }

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
    const hierarchyRoot = d3.hierarchy(treeData);
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
      .attr('dy', 14)
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
    nodeUpdate.select('text.node-secondary').attr('x', labelOffset).text((d) => (d.data.secondary ? d.data.secondary : ''));

    nodes
      .exit()
      .transition()
      .duration(250)
      .style('opacity', 0)
      .remove();

    const hideTooltip = () => {
      tooltipSel.transition().duration(120).style('opacity', 0);
    };

    const showTooltip = (event, d) => {
      if (!d.data.known || !d.data.taxon) {
        hideTooltip();
        return;
      }
      const { primary, secondary } = getTaxonDisplayNames(d.data.taxon);
      const rankLabel = t(`ranks.${d.data.rank}`, {}, d.data.rank);
      const wikiUrl = d.data.wikiUrl;
      const summary =
        d.data.taxon?.wikipedia_summary ||
        d.data.taxon?.summary ||
        t('hard.phylo.placeholder', {}, 'Description à venir prochainement.');
      const truncatedSummary =
        summary && summary.length > 240 ? `${summary.slice(0, 240)}…` : summary;
      tooltipSel
        .html(
          `<div class="tooltip-rank">${rankLabel}</div>
           <div class="tooltip-name">${primary || d.data.taxon.name}</div>
           ${secondary ? `<div class="tooltip-secondary">${secondary}</div>` : ''}
           <div class="tooltip-summary">${truncatedSummary}</div>
           ${
             wikiUrl
               ? `<a href="${wikiUrl}" target="_blank" rel="noreferrer">${t('hard.phylo.more', {}, 'Voir la fiche')}</a>`
               : ''
           }`
        )
        .style('opacity', 1)
        .style('left', `${event.pageX + 14}px`)
        .style('top', `${event.pageY - 10}px`);
    };

    nodes
      .merge(nodeEnter)
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip)
      .style('cursor', (d) => (d.data.known ? 'help' : 'default'))
      .on('click', null);

    return () => {
      tooltipSel.on('.interrupt', null);
    };
  }, [getTaxonDisplayNames, t, treeData]);

  useEffect(
    () => () => {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).remove();
      }
    },
    []
  );

  return (
    <div className="phylo-tree-shell">
      <div className="phylo-scroll">
        <svg ref={svgRef} className="phylo-svg" role="img" aria-label={t('hard.phylo.title', {}, 'Arbre phylogénétique')}></svg>
      </div>
    </div>
  );
}

export default PhylogeneticTree;
