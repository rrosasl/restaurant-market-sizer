import type { ReactNode } from 'react';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';

interface AppShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel: string;
  onSettings?: () => void;
  settingsLabel?: string;
  children: ReactNode;
  /** Sticky footer, e.g. the primary action or the running totals panel. */
  footer?: ReactNode;
}

/**
 * Page chrome: a sticky header that survives scrolling and an optional sticky
 * footer. Both respect the safe-area insets so the app behaves once it has
 * been installed to the home screen and there is no browser UI to hide behind.
 */
export function AppShell({
  title,
  subtitle,
  onBack,
  backLabel,
  onSettings,
  settingsLabel,
  children,
  footer,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-100/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {onBack && (
            <button type="button" onClick={onBack} className="btn-ghost -ml-2 px-2" aria-label={backLabel}>
              <ArrowLeft size={22} aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
          </div>
          {onSettings && (
            <button
              type="button"
              onClick={onSettings}
              className="btn-ghost -mr-2 px-2"
              aria-label={settingsLabel}
            >
              <SettingsIcon size={21} aria-hidden />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>

      {footer && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur">
          <div className="mx-auto w-full max-w-5xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
