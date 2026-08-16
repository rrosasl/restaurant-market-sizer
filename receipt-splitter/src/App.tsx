import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Bill } from './types';
import { translatorFor } from './strings';
import { formatAmount } from './lib/money';
import {
  loadCurrentBill,
  loadHistory,
  loadRoster,
  loadSettings,
  newBill,
  rememberNames,
  saveCurrentBill,
  saveSettings,
  saveToHistory,
  type Settings,
} from './lib/storage';
import { billReducer } from './state/billReducer';
import { UiContext } from './state/uiContext';
import { StartScreen } from './screens/StartScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { ItemsScreen } from './screens/ItemsScreen';
import { AssignScreen } from './screens/AssignScreen';
import { TotalsScreen } from './screens/TotalsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export type Screen =
  | 'start'
  | 'capture'
  | 'people'
  | 'items'
  | 'assign'
  | 'totals'
  | 'settings';

/** Linear flow, so back always has somewhere sensible to go. */
const PREVIOUS: Record<Screen, Screen> = {
  start: 'start',
  capture: 'start',
  people: 'start',
  items: 'people',
  assign: 'items',
  totals: 'assign',
  settings: 'start',
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [bill, dispatch] = useReducer(billReducer, null, () => loadCurrentBill() ?? newBill());
  const [screen, setScreen] = useState<Screen>('start');
  const [history, setHistory] = useState<Bill[]>(() => loadHistory());
  const [roster, setRoster] = useState<string[]>(() => loadRoster());
  /** Where `settings` should return to, so it can be opened from anywhere. */
  const [settingsReturn, setSettingsReturn] = useState<Screen>('start');

  // The working bill is written back on every change: a phone that dies
  // mid-dinner should come back with the bill exactly as it was.
  useEffect(() => {
    saveCurrentBill(bill);
  }, [bill]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  const ui = useMemo(
    () => ({
      lang: settings.lang,
      t: translatorFor(settings.lang),
      currency: bill.currency,
      fmt: (cents: number) => formatAmount(cents, bill.currency, settings.lang),
    }),
    [settings.lang, bill.currency],
  );

  const goSettings = useCallback(() => {
    setSettingsReturn(screen);
    setScreen('settings');
  }, [screen]);

  const goBack = useCallback(() => {
    setScreen((current) => (current === 'settings' ? settingsReturn : PREVIOUS[current]));
  }, [settingsReturn]);

  /**
   * Committing a bill to history is what makes it "a past bill". It happens
   * when the user reaches totals — the point at which the split is real —
   * and again on every later edit, since `saveToHistory` replaces by id.
   */
  const commitToHistory = useCallback((current: Bill) => {
    setHistory(saveToHistory(current));
    setRoster(rememberNames(current.people.map((p) => p.name)));
  }, []);

  const startBill = useCallback(
    (source: Bill['source']) => {
      dispatch({ type: 'replace', bill: newBill('EUR', source) });
      setScreen(source === 'photo' ? 'capture' : 'people');
    },
    [],
  );

  const openBill = useCallback((saved: Bill) => {
    dispatch({ type: 'replace', bill: saved });
    setScreen('assign');
  }, []);

  const screenProps = { bill, dispatch, onSettings: goSettings, onBack: goBack, go: setScreen };

  return (
    <UiContext.Provider value={ui}>
      {screen === 'start' && (
        <StartScreen
          bill={bill}
          history={history}
          onStart={startBill}
          onResume={() => setScreen(bill.people.length === 0 ? 'people' : 'assign')}
          onOpen={openBill}
          onHistoryChange={setHistory}
          onSettings={goSettings}
        />
      )}

      {screen === 'people' && <PeopleScreen {...screenProps} roster={roster} />}

      {screen === 'items' && <ItemsScreen {...screenProps} />}

      {screen === 'assign' && (
        <AssignScreen
          {...screenProps}
          onTotals={() => {
            commitToHistory(bill);
            setScreen('totals');
          }}
        />
      )}

      {screen === 'totals' && <TotalsScreen {...screenProps} />}

      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          roster={roster}
          onRosterChange={setRoster}
          onBack={goBack}
        />
      )}
    </UiContext.Provider>
  );
}
