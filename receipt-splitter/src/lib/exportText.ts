import type { Bill, ExtraKind } from '../types';
import { formatAmountPlain } from './money';
import { computeTotals } from './totals';
import { translate, type Lang } from '../strings';
import type { StringKey } from '../strings';

const EXTRA_LABELS: Record<ExtraKind, StringKey> = {
  tax: 'extraTax',
  service: 'extraService',
  cover: 'extraCover',
  tip: 'extraTip',
};

/**
 * Render the split as plain text for pasting into a group chat.
 *
 * Deliberately plain: no markdown, no box drawing, no emoji beyond a single
 * marker, because this gets pasted into WhatsApp on a narrow screen where
 * anything clever wraps badly. Each person's extras stay on their own line so
 * the number is explainable without reopening the app.
 */
export function billToText(bill: Bill, lang: Lang): string {
  const t = (key: StringKey, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
  const money = (cents: number) => formatAmountPlain(cents, bill.currency);
  const totals = computeTotals(bill);
  const itemById = new Map(bill.items.map((i) => [i.id, i]));
  const extraById = new Map(bill.extras.map((e) => [e.id, e]));

  const lines: string[] = [];

  const header = [bill.merchant, formatDate(bill.date ?? bill.createdAt, lang)]
    .filter(Boolean)
    .join(' · ');
  lines.push(header === '' ? t('appName') : header);
  lines.push('');

  for (const person of bill.people) {
    const share = totals.perPerson.find((p) => p.personId === person.id);
    if (!share) continue;

    lines.push(`${person.name}: ${money(share.total)}`);

    for (const itemShare of share.itemShares) {
      const item = itemById.get(itemShare.itemId);
      if (!item) continue;
      const name = item.name.trim() === '' ? t('itemName') : item.name;
      // Only note the weight when it isn't a plain equal share, so the common
      // case stays readable.
      const suffix = itemShare.weight > 1 ? ` (×${itemShare.weight})` : '';
      lines.push(`  ${name}${suffix} ${money(itemShare.amount)}`);
    }

    for (const extraShare of share.extraShares) {
      const extra = extraById.get(extraShare.extraId);
      if (!extra) continue;
      lines.push(`  ${t(EXTRA_LABELS[extra.kind])} ${money(extraShare.amount)}`);
    }

    lines.push('');
  }

  if (totals.unassignedTotal !== 0) {
    lines.push(`${t('unassignedLabel')}: ${money(totals.unassignedTotal)}`);
  }
  lines.push(`${t('totalsBillTotal')}: ${money(totals.grandTotal)}`);

  return lines.join('\n');
}

function formatDate(value: string | number, lang: Lang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Copy text to the clipboard, falling back to a hidden textarea for browsers
 * that withhold the async clipboard API outside a secure context. Returns
 * false when both routes fail, so the UI can tell the user to copy by hand
 * rather than silently doing nothing.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
