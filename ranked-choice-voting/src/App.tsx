import { BrowserRouter, HashRouter, Link, Route, Routes } from 'react-router-dom';
import { useBackendInfo } from './lib/hooks';
import { firebaseConfig } from './lib/firebase-config';
import { LanguageProvider, useI18n } from './lib/i18n';
import { HomePage } from './pages/HomePage';
import { PollPage } from './pages/PollPage';
import { ResultsPage } from './pages/ResultsPage';

function Shell() {
  const { mode } = useBackendInfo();
  const { t, lang, setLang } = useI18n();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="text-xl">🗳️</span>
            <span className="hidden truncate font-semibold tracking-tight text-slate-900 min-[420px]:inline dark:text-slate-100">
              {t('appName')}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {/* Both languages stay visible with the active one filled in. A
                single-label toggle was ambiguous (does "ES" mean the current
                language or the one you'd switch to?) and gave no obvious
                visual change on tap. */}
            <div
              role="group"
              aria-label={t('languageLabel')}
              className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800/70"
            >
              {(['en', 'es'] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={active}
                    title={code === 'en' ? 'English' : 'Español'}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                      active
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {code.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <Link
              to="/"
              className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white"
            >
              {t('newPoll')}
            </Link>
          </div>
        </div>
        {mode === 'local' && (
          <div className="border-t border-amber-200/60 bg-amber-50/90 px-4 py-1.5 text-center text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
            {t('demoBanner')}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/poll/:pollId" element={<PollPage />} />
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  // Demo mode (no Firebase) may be hosted anywhere — including as a static
  // artifact page with no SPA fallback — so it routes by hash. The real
  // deployment uses clean URLs backed by the Firebase Hosting rewrite.
  const Router = firebaseConfig ? BrowserRouter : HashRouter;
  return (
    <LanguageProvider>
      <Router>
        <Shell />
      </Router>
    </LanguageProvider>
  );
}

export default App;
