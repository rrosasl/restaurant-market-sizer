import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

export interface BarDatum {
  name: string;
  votes: number;
}

export function FirstChoiceBarChart({ data }: { data: BarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'currentColor', opacity: 0.05 }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
