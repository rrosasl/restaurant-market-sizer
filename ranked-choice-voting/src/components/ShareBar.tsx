import { useState } from 'react';
import { useI18n } from '../lib/i18n';

export function ShareBar({ pollName, highlight }: { pollName: string; highlight: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + window.location.pathname.replace(/\/results$/, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions) — select-and-copy fallback.
      window.prompt(t('copyPrompt'), url);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: pollName || 'Ranked-choice poll', url });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <div
      className={`rounded-2xl p-4 ring-1 backdrop-blur ${
        highlight
          ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/10 dark:ring-brand-500/40'
          : 'bg-white/80 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10'
      }`}
    >
      {highlight && (
        <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          {t('shareCreated')}
        </p>
      )}
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          {copied ? t('copied') : t('copyLink')}
        </button>
        {typeof navigator.share === 'function' && (
          <button
            type="button"
            onClick={share}
            aria-label={t('shareBtn')}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('shareBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
