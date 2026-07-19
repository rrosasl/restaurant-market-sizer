import { Reorder, useDragControls } from 'framer-motion';
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

function RankingRow({
  option,
  index,
  count,
  onMove,
}: {
  option: PollOption;
  index: number;
  count: number;
  onMove: (id: string, delta: number) => void;
}) {
  // Drag starts only from the handle (dragListener={false}): a whole-row drag
  // hijacks vertical touch gestures, making the page impossible to scroll on
  // phones — the handle gets touch-action:none, the rest of the row scrolls.
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm sm:gap-3 sm:px-3 dark:border-slate-700 dark:bg-slate-800"
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
    >
      <button
        type="button"
        aria-label={`Drag to move ${option.name}`}
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-xl text-slate-400 select-none hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing dark:hover:bg-slate-700 dark:hover:text-slate-300"
      >
        ⠿
      </button>
      <RankBadge index={index} />
      <span className="min-w-0 flex-1 font-medium break-words select-none text-slate-800 dark:text-slate-100">
        {option.name}
      </span>
      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          type="button"
          aria-label={`Move ${option.name} up`}
          disabled={index === 0}
          onClick={() => onMove(option.id, -1)}
          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move ${option.name} down`}
          disabled={index === count - 1}
          onClick={() => onMove(option.id, 1)}
          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          ▼
        </button>
      </div>
    </Reorder.Item>
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
        <RankingRow key={option.id} option={option} index={index} count={order.length} onMove={move} />
      ))}
    </Reorder.Group>
  );
}
