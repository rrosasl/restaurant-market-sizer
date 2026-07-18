import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BordaResult, PollOption } from '../types';

// Points-by-rank is an ordinal dimension (1st-choice points matter more than 5th-choice
// points), so it gets a single-hue sequential ramp rather than the categorical rainbow
// used for candidate identity elsewhere — dark = high-value rank, light = low-value rank.
const RANK_RAMP_DARK = { r: 0x43, g: 0x38, b: 0xca }; // brand-700
const RANK_RAMP_LIGHT = { r: 0xe0, g: 0xe7, b: 0xff }; // brand-100

function rankColor(rankIndex: number, rankCount: number): string {
  const t = rankCount <= 1 ? 0 : rankIndex / (rankCount - 1);
  const r = Math.round(RANK_RAMP_DARK.r + (RANK_RAMP_LIGHT.r - RANK_RAMP_DARK.r) * t);
  const g = Math.round(RANK_RAMP_DARK.g + (RANK_RAMP_LIGHT.g - RANK_RAMP_DARK.g) * t);
  const b = Math.round(RANK_RAMP_DARK.b + (RANK_RAMP_LIGHT.b - RANK_RAMP_DARK.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function BordaChart({ result, options }: { result: BordaResult; options: PollOption[] }) {
  const optionName = new Map(options.map((o) => [o.id, o.name]));
  const rankCount = options.length;

  const data = result.scores.map((s) => {
    const row: Record<string, string | number> = { name: optionName.get(s.optionId) ?? s.optionId, total: s.total };
    s.byRank.forEach((points, i) => {
      row[`rank${i}`] = points;
    });
    return row;
  });

  // Taller charts need more room per bar; keep it compact for short candidate lists.
  const height = Math.max(220, data.length * 48);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: 'currentColor' }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'currentColor', opacity: 0.05 }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
            formatter={(value, key) => {
              const rankIndex = Number(String(key).replace('rank', ''));
              return [`${value} pts`, `${ordinal(rankIndex + 1)}-choice votes`];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(key: string) => `${ordinal(Number(key.replace('rank', '')) + 1)} choice`}
          />
          {Array.from({ length: rankCount }, (_, i) => (
            <Bar key={i} dataKey={`rank${i}`} stackId="points" fill={rankColor(i, rankCount)} radius={i === rankCount - 1 ? [0, 4, 4, 0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
