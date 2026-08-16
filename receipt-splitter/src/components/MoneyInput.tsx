import { useEffect, useState } from 'react';
import type { Cents } from '../types';
import { centsToInput, parseAmount } from '../lib/money';

interface MoneyInputProps {
  value: Cents | null;
  onChange: (cents: Cents | null) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  id?: string;
}

/**
 * A money field that keeps the raw keystrokes while the user is typing and
 * only normalises on blur.
 *
 * Committing the parsed value on every keystroke would fight the typist:
 * "14," parses to 1400 and would rewrite itself to "14,00" before the cents
 * were entered. So the text is local state, the parsed cents flow up on each
 * change, and the display is reconciled once focus leaves.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = '',
  id,
}: MoneyInputProps) {
  const [text, setText] = useState(() => centsToInput(value));
  const [focused, setFocused] = useState(false);

  // Follow external changes (OCR results, a reset bill) unless the user is
  // mid-edit, in which case their keystrokes win.
  useEffect(() => {
    if (!focused) setText(centsToInput(value));
  }, [value, focused]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      className={`field text-right tabular-nums ${className}`}
      placeholder={placeholder ?? '0,00'}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseAmount(text);
        onChange(parsed);
        setText(centsToInput(parsed));
      }}
    />
  );
}
