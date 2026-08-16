import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useUi } from '../state/uiContext';
import { clearRoster, type Settings } from '../lib/storage';
import type { Lang } from '../strings';

interface SettingsScreenProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  roster: string[];
  onRosterChange: (roster: string[]) => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  onChange,
  roster,
  onRosterChange,
  onBack,
}: SettingsScreenProps) {
  const { t } = useUi();
  const [code, setCode] = useState(settings.accessCode);
  const [saved, setSaved] = useState(false);

  return (
    <AppShell title={t('settingsTitle')} onBack={onBack} backLabel={t('back')}>
      <div className="space-y-4">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('settingsLanguage')}
          </h2>
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">
            {(['en', 'es'] as const).map((lang: Lang) => (
              <button
                key={lang}
                type="button"
                aria-pressed={settings.lang === lang}
                onClick={() => onChange({ ...settings, lang })}
                className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition ${
                  settings.lang === lang ? 'bg-white text-accent-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t(lang === 'es' ? 'settingsLanguageEs' : 'settingsLanguageEn')}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('settingsAccessCode')}
          </h2>
          <p className="mb-3 text-sm text-slate-500">{t('settingsAccessCodeHint')}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onChange({ ...settings, accessCode: code.trim() });
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            <input
              className="field flex-1"
              type="password"
              autoComplete="off"
              aria-label={t('settingsAccessCode')}
              placeholder={t('settingsAccessCodePlaceholder')}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSaved(false);
              }}
            />
            <button type="submit" className="btn-primary px-5">
              {saved ? t('settingsSaved') : t('settingsSave')}
            </button>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('settingsRosterTitle')}
          </h2>
          <p className="mb-3 text-sm text-slate-500">{t('settingsRosterHint')}</p>
          {roster.length === 0 ? (
            <p className="text-sm text-slate-400">{t('settingsRosterEmpty')}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {roster.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn-danger w-full"
                onClick={() => {
                  clearRoster();
                  onRosterChange([]);
                }}
              >
                {t('settingsClearRoster')}
              </button>
            </>
          )}
        </section>

        <p className="px-2 pb-4 text-center text-xs text-slate-400">{t('settingsAbout')}</p>
      </div>
    </AppShell>
  );
}
