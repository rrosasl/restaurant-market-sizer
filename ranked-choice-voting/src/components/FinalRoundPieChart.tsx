import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

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

export interface PieDatum {
  name: string;
  votes: number;
}

export function FinalRoundPieChart({ data }: { data: PieDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="votes" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
