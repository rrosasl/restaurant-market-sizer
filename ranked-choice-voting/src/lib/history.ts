/**
 * Device-local poll history ("link-only" mode: there is no global poll list,
 * so the home page shows only polls this browser created or voted in).
 */
export interface HistoryEntry {
  pollId: string;
  name: string;
  role: 'created' | 'voted';
  at: number;
}

const HISTORY_KEY = 'rcv-history';
const VOTER_NAME_KEY = 'rcv-voter-name';

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return list.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function recordHistory(pollId: string, name: string, role: 'created' | 'voted'): void {
  const list = getHistory().filter((e) => e.pollId !== pollId || e.role !== role);
  // 'created' outranks 'voted' for the same poll — don't show it twice.
  const deduped = role === 'created' ? list.filter((e) => e.pollId !== pollId) : list;
  if (deduped.some((e) => e.pollId === pollId && e.role === 'created')) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped));
    return;
  }
  deduped.unshift({ pollId, name, role, at: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped.slice(0, 100)));
}

export function getRememberedVoterName(): string {
  return localStorage.getItem(VOTER_NAME_KEY) ?? '';
}

export function rememberVoterName(name: string): void {
  if (name.trim()) localStorage.setItem(VOTER_NAME_KEY, name.trim());
}
