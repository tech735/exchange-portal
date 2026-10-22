import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * Chart palette, brand-led and checked with the data-viz validator
 * (light surface): CVD ΔE ≥ 9.1, normal-vision ΔE ≥ 18.6. Three slots sit
 * below 3:1 contrast on white, so every chart here also shows values as text.
 */
export const SERIES = {
  indigo: '#3d3be0',
  azure: '#36a5ee',
  aqua: '#1baf7a',
  amber: '#eda100',
  critical: '#e34948',
};

const AXIS = { fontSize: 11, fill: 'hsl(var(--faint-foreground))' };

/* ------------------------------------------------------------------ */
/* Sparkline (KPI cards) — decorative trend, value is in the card text */
/* ------------------------------------------------------------------ */

export function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-11 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, (max: number) => Math.max(1, max * 1.15)]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${id})`} isAnimationActive animationDuration={500} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Volume: lodged vs completed per day                                 */
/* ------------------------------------------------------------------ */

export interface VolumePoint { date: Date; lodged: number; completed: number }

function VolumeTooltip({ active, payload }: { active?: boolean; payload?: { payload: VolumePoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-overlay">
      <p className="text-[11px] text-muted-foreground">{format(p.date, 'EEE, d MMM')}</p>
      {([['Lodged', p.lodged, SERIES.indigo], ['Completed', p.completed, SERIES.aqua]] as const).map(([l, v, c]) => (
        <p key={l} className="mt-1 flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: c }} />
          <span className="text-muted-foreground">{l}</span>
          <span className="ml-auto font-semibold text-foreground tabular">{v}</span>
        </p>
      ))}
    </div>
  );
}

export function VolumeChart({ data }: { data: VolumePoint[] }) {
  const rows = data.map((d) => ({ ...d, t: d.date.getTime() }));
  const step = Math.max(1, Math.ceil(rows.length / 6));
  const ticks = rows.filter((_, i) => i % step === 0 || i === rows.length - 1).map((r) => r.t);
  return (
    <>
      <div className="h-64 w-full lg:h-[318px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="vol-lodged" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.indigo} stopOpacity={0.2} />
                <stop offset="100%" stopColor={SERIES.indigo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks}
              tickFormatter={(t) => format(new Date(t), 'd MMM')} tick={AXIS} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<VolumeTooltip />} cursor={{ stroke: 'hsl(var(--input))', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="lodged" name="Lodged" stroke={SERIES.indigo} strokeWidth={2} fill="url(#vol-lodged)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} dot={false} animationDuration={500} />
            <Line type="monotone" dataKey="completed" name="Completed" stroke={SERIES.aqua} strokeWidth={2}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} dot={false} animationDuration={500} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Same numbers for screen readers */}
      <div className="sr-only">
      <table>
        <caption>Exchanges lodged and completed per day</caption>
        <thead><tr><th>Date</th><th>Lodged</th><th>Completed</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date.toISOString()}><td>{format(d.date, 'd MMM')}</td><td>{d.lodged}</td><td>{d.completed}</td></tr>)}</tbody>
      </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Donut: where open exchanges are                                     */
/* ------------------------------------------------------------------ */

export interface Slice { key: string; label: string; value: number; color: string; to?: string }

export function StageDonut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col gap-5 sm:max-lg:flex-row sm:max-lg:items-center sm:max-lg:gap-10">
      <div className="relative mx-auto h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown.length ? shown : [{ key: 'none', label: 'None', value: 1, color: 'hsl(var(--muted))' }]}
              dataKey="value" nameKey="label" innerRadius="72%" outerRadius="100%" paddingAngle={shown.length > 1 ? 2 : 0}
              cornerRadius={4} stroke="none" startAngle={90} endAngle={-270} animationDuration={500}>
              {(shown.length ? shown : [{ color: 'hsl(var(--muted))' }]).map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-semibold tabular">{total}</span>
          <span className="text-xs text-muted-foreground">open</span>
        </div>
      </div>
      <ul className="space-y-1 sm:max-lg:flex-1">
        {slices.map((s) => {
          const pct = total ? Math.round((s.value / total) * 100) : 0;
          const row = (
            <>
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="flex-1 truncate text-sm text-foreground">{s.label}</span>
              <span className="text-sm font-semibold tabular text-foreground">{s.value}</span>
              <span className="w-9 text-right text-xs tabular text-faint">{pct}%</span>
            </>
          );
          return (
            <li key={s.key}>
              {s.to
                ? <Link to={s.to} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">{row}</Link>
                : <div className="flex items-center gap-2.5 py-1.5">{row}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress ring                                                       */
/* ------------------------------------------------------------------ */

export function Ring({ value, color = SERIES.indigo, label }: { value: number | null; color?: string; label: string }) {
  const r = 62, c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="relative mx-auto size-40">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`${label}: ${value === null ? 'no data' : Math.round(v * 100) + '%'}`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="transition-[stroke-dashoffset] duration-700 ease-out-soft" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-semibold tabular">{value === null ? '—' : `${Math.round(v * 100)}%`}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars (single series)                                     */
/* ------------------------------------------------------------------ */

export function BarList({ rows, color = SERIES.indigo, empty }: { rows: { label: string; value: number }[]; color?: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="font-semibold tabular text-foreground">{r.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out-soft')} style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
