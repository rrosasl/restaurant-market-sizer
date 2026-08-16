import { useEffect, useMemo, useRef, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { useI18n } from '../lib/i18n';
import type { SankeyData } from '../types';

const PALETTE = [
  '#6366f1',
  '#22c55e',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#eab308',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#a855f7',
];

function colorForOption(optionId: string, order: string[]): string {
  if (optionId === 'EXHAUSTED') return '#94a3b8';
  const idx = order.indexOf(optionId);
  return PALETTE[idx >= 0 ? idx % PALETTE.length : 0];
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

interface LayoutNode {
  id: string;
  name: string;
  value: number;
  optionId: string;
  round: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
  value: number;
  isTransfer: boolean;
  width: number;
  y0: number;
  y1: number;
}

/** Below this rendered width there isn't room for labels beside each node, so
 *  they move above the node instead and shrink to keep everything in view
 *  without horizontal scrolling. */
const COMPACT_BREAKPOINT = 520;

export function SankeyChart({ data, optionOrder }: { data: SankeyData; optionOrder: string[] }) {
  const { t, tn } = useI18n();
  const [hovered, setHovered] = useState<string | null>(null);
  const displayName = (optionId: string, name: string) => (optionId === 'EXHAUSTED' ? t('exhausted') : name);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const isCompact = width > 0 && width < COMPACT_BREAKPOINT;
  const nodeWidth = isCompact ? 10 : 16;
  const nodePadding = isCompact ? 30 : 24;
  const topMargin = isCompact ? 44 : 32;
  const fontSize = isCompact ? 9 : 12;

  const roundCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const n of data.nodes) counts.set(n.round, (counts.get(n.round) ?? 0) + 1);
    return counts;
  }, [data.nodes]);
  const maxPerRound = Math.max(1, ...Array.from(roundCounts.values()));
  const rowHeight = isCompact ? 52 : 64;
  const height = Math.max(240, maxPerRound * rowHeight + topMargin);
  // A poll that resolves in a single round (an outright majority, or only two options)
  // produces a Sankey graph with just one column and zero links. d3-sankey's layer-spacing
  // divides by (numColumns - 1), so a single column is a division by zero that yields NaN
  // positions for every node. Lay that case out by hand instead of calling d3-sankey.
  const singleColumn = roundCounts.size <= 1;

  const { nodes, links } = useMemo(() => {
    if (width <= 0) return { nodes: [] as LayoutNode[], links: [] as LayoutLink[] };

    if (singleColumn) {
      const total = data.nodes.reduce((sum, n) => sum + n.value, 0) || 1;
      const availableHeight = Math.max(1, height - topMargin - 8 - nodePadding * Math.max(0, data.nodes.length - 1));
      let y = topMargin;
      const laidOut: LayoutNode[] = data.nodes.map((n) => {
        const h = Math.max(4, (n.value / total) * availableHeight);
        const node: LayoutNode = {
          ...n,
          x0: width / 2 - nodeWidth / 2,
          x1: width / 2 + nodeWidth / 2,
          y0: y,
          y1: y + h,
        };
        y += h + nodePadding;
        return node;
      });
      return { nodes: laidOut, links: [] as LayoutLink[] };
    }

    // d3-sankey mutates its input, so hand it plain clones typed loosely.
    const graph = {
      // `fixedValue` makes d3-sankey trust our own tally-derived value instead of the
      // default (sum of a node's link weights), which would be 0 for any node whose
      // value doesn't come entirely from links.
      nodes: data.nodes.map((n) => ({ ...n, fixedValue: n.value })),
      links: data.links.map((l) => ({ ...l })),
    };
    // d3-sankey's built-in aligns (including sankeyJustify) infer each node's column
    // from link connectivity: sankeyJustify in particular pushes any node with zero
    // *outgoing* links into the last column. A candidate eliminated with 0 votes has
    // no ballots to transfer, so its (correctly omitted, zero-weight) outgoing link
    // is simply absent — and it would get wrongly shoved into the final round instead
    // of staying in the round it was actually eliminated in. Map columns from our own
    // `round` field instead, so placement never depends on which links happen to exist.
    const sortedRounds = Array.from(roundCounts.keys()).sort((a, b) => a - b);
    const roundToColumn = new Map(sortedRounds.map((r, i) => [r, i]));
    const layout = sankey<Record<string, unknown>, Record<string, unknown>>()
      .nodeId((d) => (d as { id: string }).id)
      .nodeAlign((d) => roundToColumn.get((d as unknown as { round: number }).round) ?? 0)
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .extent([
        [1, topMargin],
        [width - 1, height - 8],
      ])(graph as never);

    return {
      nodes: layout.nodes as unknown as LayoutNode[],
      links: layout.links as unknown as LayoutLink[],
    };
  }, [data, width, height, singleColumn, nodeWidth, nodePadding, topMargin, roundCounts]);

  const linkPath = sankeyLinkHorizontal();

  // Roughly how many characters fit per column at the compact font size, so
  // above-node labels never run into their neighbors' columns.
  const compactMaxChars = Math.max(6, Math.floor((width / Math.max(1, roundCounts.size)) / 5.2));
  const roundNumbers = useMemo(() => Array.from(roundCounts.keys()), [roundCounts]);
  const minRound = Math.min(...roundNumbers);
  const maxRound = Math.max(...roundNumbers);

  return (
    <div ref={containerRef} className="w-full">
      {nodes.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400">
          {width <= 0 ? ' ' : t('notEnoughRounds')}
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={t('sankeyAria')}>
          <g>
            {links.map((link, i) => {
              const id = `${link.source.id}->${link.target.id}`;
              const isDim = hovered !== null && hovered !== link.source.optionId && hovered !== link.target.optionId;
              return (
                <path
                  key={id + i}
                  d={linkPath(link as never) ?? undefined}
                  fill="none"
                  stroke={colorForOption(link.isTransfer ? link.source.optionId : link.target.optionId, optionOrder)}
                  strokeOpacity={isDim ? 0.08 : link.isTransfer ? 0.55 : 0.28}
                  strokeWidth={Math.max(1, link.width)}
                  className="transition-[stroke-opacity] duration-200"
                >
                  <title>
                    {displayName(link.source.optionId, link.source.name)} → {displayName(link.target.optionId, link.target.name)}: {tn('voteWord', link.value)}
                    {link.isTransfer ? t('transferred') : ''}
                  </title>
                </path>
              );
            })}
          </g>
          <g>
            {nodes.map((node) => {
              const color = colorForOption(node.optionId, optionOrder);
              const isDim = hovered !== null && hovered !== node.optionId;
              const labelLeft = node.x0 < width / 2;
              const label = `${displayName(node.optionId, node.name)} (${node.value})`;
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHovered(node.optionId)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={node.x0}
                    y={node.y0}
                    width={node.x1 - node.x0}
                    height={Math.max(1, node.y1 - node.y0)}
                    fill={color}
                    opacity={isDim ? 0.3 : 1}
                    rx={3}
                    className="transition-opacity duration-200"
                  >
                    <title>
                      {displayName(node.optionId, node.name)} — {t('roundN', { n: node.round })}: {tn('voteWord', node.value)}
                    </title>
                  </rect>
                  {isCompact ? (
                    <text
                      x={
                        // Center labels over interior columns, but anchor the first/last
                        // column's label to its inner edge so it doesn't run past the SVG.
                        maxRound > minRound && node.round === minRound
                          ? node.x0
                          : maxRound > minRound && node.round === maxRound
                            ? node.x1
                            : (node.x0 + node.x1) / 2
                      }
                      y={node.y0 - 4}
                      textAnchor={
                        maxRound > minRound && node.round === minRound
                          ? 'start'
                          : maxRound > minRound && node.round === maxRound
                            ? 'end'
                            : 'middle'
                      }
                      fontSize={fontSize}
                      fontWeight={600}
                      fill="currentColor"
                      opacity={isDim ? 0.35 : 0.9}
                      className="pointer-events-none select-none"
                    >
                      {truncate(label, compactMaxChars)}
                    </text>
                  ) : (
                    <text
                      x={labelLeft ? node.x1 + 8 : node.x0 - 8}
                      y={(node.y0 + node.y1) / 2}
                      dy="0.32em"
                      textAnchor={labelLeft ? 'start' : 'end'}
                      fontSize={fontSize}
                      fontWeight={600}
                      fill="currentColor"
                      opacity={isDim ? 0.35 : 0.9}
                      className="pointer-events-none select-none"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g>
            {Array.from(roundCounts.keys())
              .sort((a, b) => a - b)
              .map((round, i, all) => {
                const roundNodes = nodes.filter((n) => n.round === round);
                if (roundNodes.length === 0) return null;
                // Center labels on interior columns, but anchor the first/last column's
                // label to its inner edge so the text doesn't run past the SVG bounds.
                const isFirst = i === 0 && all.length > 1;
                const isLast = i === all.length - 1 && all.length > 1;
                const x = isFirst ? roundNodes[0].x0 : isLast ? roundNodes[0].x1 : (roundNodes[0].x0 + roundNodes[0].x1) / 2;
                const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                return (
                  <text
                    key={round}
                    x={x}
                    y={16}
                    textAnchor={anchor}
                    fontSize={isCompact ? 9 : 11}
                    fontWeight={700}
                    fill="currentColor"
                    opacity={0.45}
                    className="uppercase tracking-wide"
                  >
                    {t('roundN', { n: round })}
                  </text>
                );
              })}
          </g>
        </svg>
      )}
    </div>
  );
}
