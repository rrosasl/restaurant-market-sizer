import { createContext, useContext } from 'react';
import type { Cents, Currency } from '../types';
import { translatorFor, type Lang, type Translator } from '../strings';

export interface UiContextValue {
  lang: Lang;
  t: Translator;
  currency: Currency;
  /** Format cents in the bill's currency and the active language. */
  fmt: (cents: Cents) => string;
}

/**
 * Language and currency formatting reach almost every component, and threading
 * them through as props obscures the actual data flow, so they travel in
 * context. The bill itself deliberately does not — mutations stay explicit.
 */
export const UiContext = createContext<UiContextValue>({
  lang: 'en',
  t: translatorFor('en'),
  currency: 'EUR',
  fmt: (cents) => String(cents),
});

export function useUi(): UiContextValue {
  return useContext(UiContext);
}
