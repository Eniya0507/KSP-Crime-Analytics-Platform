import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from 'recharts';
import type { ShapFeature } from '../types';

const AXIS = { stroke: '#7ea3da', fontSize: 11, tickLine: false, axisLine: false };
const GRID = { stroke: 'rgba(255,255,255,0.06)' };

export const CHART_COLORS = ['#3b82f6', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#a78bfa', '#f472b6', '#facc15'];

// ---- Line trend ----
export function TrendLine({ data, xKey, yKey, yKey2, height = 260, xLabel, yLabel }: {
  data: any[]; xKey: string; yKey: string; yKey2?: string; height?: number; xLabel?: string; yLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={xKey} {...AXIS} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, fill: '#7ea3da', fontSize: 10 } : undefined} />
        <YAxis {...AXIS} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#7ea3da', fontSize: 10 } : undefined} />
        <Tooltip />
        {yKey2 && <Legend />}
        <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
        {yKey2 && <Line type="monotone" dataKey={yKey2} stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---- Area with forecast band ----
export function ForecastArea({ data, height = 320 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} angle={-25} textAnchor="end" height={50} interval={2} />
        <YAxis {...AXIS} />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(59,130,246,0.12)" name="Upper CI" />
        <Area type="monotone" dataKey="lower" stroke="none" fill="rgba(7,13,27,1)" name="Lower CI" />
        <Line type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
        <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Forecast" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---- Bar ----
export function BarChartX({ data, xKey, yKey, color = '#3b82f6', height = 260, horizontal = false, yLabel }: {
  data: any[]; xKey: string; yKey: string; color?: string; height?: number; horizontal?: boolean; yLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 8, left: horizontal ? 80 : -10 }}>
        <CartesianGrid {...GRID} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS} />
            <YAxis type="category" dataKey={xKey} {...AXIS} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS} angle={-20} textAnchor="end" height={56} interval={0} />
            <YAxis {...AXIS} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#7ea3da', fontSize: 10 } : undefined} />
          </>
        )}
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Pie / donut ----
export function Donut({ data, height = 260, colors = CHART_COLORS }: { data: { name: string; value: number }[]; height?: number; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="rgba(7,13,27,0.8)">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---- Radar (multi-metric) ----
export function RadarX({ data, key2, height = 300 }: { data: any[]; key2?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#7ea3da', fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: '#7ea3da', fontSize: 10 }} angle={90} />
        <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
        {key2 && <Radar dataKey={key2} stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />}
        <Legend />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ---- SHAP waterfall ----
export function ShapWaterfall({ features, baseValue, finalScore, height = 320 }: {
  features: ShapFeature[]; baseValue: number; finalScore: number; height?: number;
}) {
  const sorted = [...features].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10);
  let running = baseValue;
  const bars = sorted.map((f) => {
    const start = running;
    running += f.value;
    return { feature: f.feature, display: f.display, start, value: f.value, end: running };
  });
  const minV = Math.min(baseValue, ...bars.map((b) => b.end), finalScore) - 2;
  const maxV = Math.max(baseValue, ...bars.map((b) => b.end), finalScore) + 2;
  const chartData: { feature: string; display: string; value: number; isBase: boolean }[] = [
    { feature: 'Base', display: 'Baseline', value: baseValue, isBase: true },
    ...bars.map((b) => ({ feature: b.feature, display: b.display, value: b.value, isBase: false })),
    { feature: 'Final', display: 'Final', value: finalScore, isBase: true },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 110 }}>
        <CartesianGrid {...GRID} />
        <XAxis type="number" domain={[minV, maxV]} {...AXIS} tickFormatter={(v) => String(Math.round(v))} />
        <YAxis type="category" dataKey="display" {...AXIS} width={110} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'contribution']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.isBase ? '#22d3ee' : (d.value as number) >= 0 ? '#ef4444' : '#10b981'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Stacked bar ----
export function StackedBar({ data, keys, height = 300, colors = CHART_COLORS }: { data: any[]; keys: string[]; height?: number; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip />
        <Legend />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
