import { useI18n } from '../lib/i18n';
import type { BordaResult, PollOption } from '../types';

export function BordaSummary({ result, options }: { result: BordaResult; options: PollOption[] }) {
  const { t } = useI18n();
  const optionName = new Map(options.map((o) => [o.id, o.name]));
  const maxTotal = result.scores[0]?.total ?? 0;

  return (
    <ul className="space-y-2">
      {result.scores.map((score, i) => {
        const isWinner = score.optionId === result.winner;
        const pctOfMax = maxTotal > 0 ? (score.total / maxTotal) * 100 : 0;
        return (
          <li
            key={score.optionId}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              isWinner
                ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40'
            }`}
          >
            <span className="w-5 shrink-0 text-sm font-semibold text-slate-400 dark:text-slate-500">{i + 1}</span>
            <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {optionName.get(score.optionId) ?? score.optionId}
              {isWinner && ' 🏆'}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${isWinner ? 'bg-brand-600' : 'bg-brand-400'}`}
                style={{ width: `${pctOfMax}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
              {t('pts', { n: score.total })}
            </span>
          </li>
        );
      })}
      <li className="pt-1 text-xs text-slate-400 dark:text-slate-500">
        {t('maxPossible', { max: result.maxPossible, n: result.totalBallots, s: result.totalBallots === 1 ? '' : 's' })}
      </li>
    </ul>
  );
}
