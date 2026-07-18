import { Reorder } from 'framer-motion';
import type { PollOption } from '../types';

function RankBadge({ index }: { index: number }) {
  const labels = ['1st', '2nd', '3rd'];
  const label = labels[index] ?? `${index + 1}th`;
  return (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold tracking-wide text-white shadow-sm">
      {label}
    </span>
  );
}

export function RankingList({
  order,
  onReorder,
}: {
  order: PollOption[];
  onReorder: (next: PollOption[]) => void;
}) {
  function move(id: string, delta: number) {
    const index = order.findIndex((o) => o.id === id);
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onReorder(next);
  }

  return (
    <Reorder.Group axis="y" values={order} onReorder={onReorder} className="space-y-2">
      {order.map((option, index) => (
        <Reorder.Item
          key={option.id}
          value={option}
          className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
          whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <RankBadge index={index} />
          <span className="flex-1 font-medium select-none text-slate-800 dark:text-slate-100">{option.name}</span>
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              aria-label={`Move ${option.name} up`}
              disabled={index === 0}
              onClick={() => move(option.id, -1)}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Move ${option.name} down`}
              disabled={index === order.length - 1}
              onClick={() => move(option.id, 1)}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ▼
            </button>
          </div>
          <span className="hidden shrink-0 text-lg text-slate-300 select-none sm:block dark:text-slate-600">⠿</span>
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}
