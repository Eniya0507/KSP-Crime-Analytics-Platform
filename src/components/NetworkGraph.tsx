import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphNode } from '../data/analytics';

interface Props {
  data: GraphData;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

const TYPE_COLORS: Record<GraphNode['type'], string> = {
  accused: '#ef4444',
  victim: '#f59e0b',
  case: '#3b82f6',
  phone: '#22d3ee',
  vehicle: '#a78bfa',
  address: '#10b981',
  bank: '#f472b6',
};

const TYPE_SIZES: Record<GraphNode['type'], number> = {
  accused: 9,
  victim: 7,
  case: 8,
  phone: 4,
  vehicle: 4,
  address: 4,
  bank: 4,
};

interface SimNode extends GraphNode {
  x: number; y: number; vx: number; vy: number;
}
interface SimEdge { source: SimNode; target: SimNode; label: string }

// Simple force-directed layout (repulsion + edge spring + centering)
export default function NetworkGraph({ data, height = 540, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(true);

  const { nodes, edges, hiddenLinks } = useMemo(() => {
    const w = width;
    const h = height;
    const simNodes: SimNode[] = data.nodes.slice(0, 220).map((n, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const r = Math.min(w, h) * 0.3;
      return { ...n, x: w / 2 + Math.cos(angle) * r, y: h / 2 + Math.sin(angle) * r, vx: 0, vy: 0 };
    });
    const idMap = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges: SimEdge[] = [];
    for (const e of data.edges) {
      const s = idMap.get(e.source);
      const t = idMap.get(e.target);
      if (s && t) simEdges.push({ source: s, target: t, label: e.label });
    }
    const hidden = data.hiddenLinks
      .filter((l) => idMap.has(l.a) && idMap.has(l.b))
      .map((l) => ({ a: idMap.get(l.a)!, b: idMap.get(l.b)!, reason: l.reason, confidence: l.confidence }));
    // Simulate
    for (let iter = 0; iter < 220; iter++) {
      // repulsion
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i], b = simNodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(8, Math.hypot(dx, dy));
          const f = 600 / (dist * dist);
          const fx = (dx / dist) * f, fy = (dy / dist) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // spring
      for (const e of simEdges) {
        const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const f = (dist - 70) * 0.04;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        e.source.vx += fx; e.source.vy += fy;
        e.target.vx -= fx; e.target.vy -= fy;
      }
      // centering + integrate
      for (const n of simNodes) {
        n.vx += (w / 2 - n.x) * 0.005;
        n.vy += (h / 2 - n.y) * 0.005;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        // bounds
        n.x = Math.max(20, Math.min(w - 20, n.x));
        n.y = Math.max(20, Math.min(h - 20, n.y));
      }
    }
    return { nodes: simNodes, edges: simEdges, hiddenLinks: hidden };
  }, [data, width, height]);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const hiddenEdges = useMemo(() => {
    if (!showHidden) return [];
    return hiddenLinks.map((l) => ({ x1: l.a.x, y1: l.a.y, x2: l.b.x, y2: l.b.y, reason: l.reason, confidence: l.confidence }));
  }, [hiddenLinks, showHidden]);

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowHidden((v) => !v)}
          className={`chip border ${showHidden ? 'border-purple-500/40 bg-purple-500/15 text-purple-300' : 'border-white/10 bg-ink-900/60 text-steel-300'}`}
        >
          Hidden links ({hiddenLinks.length})
        </button>
      </div>
      <svg ref={svgRef} width="100%" height={height} className="rounded-xl border border-white/5 bg-ink-900/40">
        {/* edges */}
        <g>
          {edges.map((e, i) => {
            const isHi = hover && (e.source.id === hover || e.target.id === hover);
            return (
              <line
                key={i}
                x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y}
                stroke={isHi ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.08)'}
                strokeWidth={isHi ? 1.4 : 0.6}
              />
            );
          })}
        </g>
        {/* hidden links (dashed) */}
        <g>
          {hiddenEdges.map((l, i) => (
            <line key={`h${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(167,139,250,0.55)" strokeWidth={1} strokeDasharray="4 3" />
          ))}
        </g>
        {/* nodes */}
        <g>
          {nodes.map((n) => {
            const r = TYPE_SIZES[n.type];
            const fill = TYPE_COLORS[n.type];
            const isSel = selected?.id === n.id;
            const isHi = hover === n.id;
            return (
              <g
                key={n.id}
                className="net-node"
                transform={`translate(${n.x},${n.y})`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { setSelected(n); onNodeClick?.(n); }}
              >
                <circle r={r + (isSel ? 4 : isHi ? 2 : 0)} fill={fill} fillOpacity={0.85} stroke={isSel ? '#fff' : 'rgba(255,255,255,0.3)'} strokeWidth={isSel ? 2 : 1} />
                {(isHi || isSel || n.type === 'accused' || n.type === 'case') && (
                  <text x={r + 4} y={3} fontSize={9} fill="#e6edf7" className="pointer-events-none">{n.label}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-steel-300/80">
        {Object.entries(TYPE_COLORS).map(([t, c]) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {t}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-purple-400" /> predicted link
        </span>
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-white/10 bg-ink-900/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{selected.label}</span>
            <button onClick={() => setSelected(null)} className="text-steel-300/60 hover:text-white">✕</button>
          </div>
          <p className="mt-1 text-xs text-steel-300/70">Type: {selected.type}{selected.districtId ? ` · District: ${selected.districtId}` : ''}{selected.risk ? ` · Risk: ${selected.risk}` : ''}{selected.gang ? ` · Gang: ${selected.gang}` : ''}</p>
        </div>
      )}
    </div>
  );
}
