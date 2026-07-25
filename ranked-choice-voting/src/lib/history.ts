import { readStored, readStoredJson, writeStored, writeStoredJson } from './storage';

/**
 * Device-local poll history ("link-only" mode: there is no global poll list,
 * so the home page shows only polls this browser created or voted in).
 *
 * All access goes through the safe storage helpers. That matters most for
 * recordHistory, which runs immediately after a ballot is saved: an
 * unguarded throw here would surface as "couldn't submit your vote" even
 * though the vote was already counted.
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
  const list = readStoredJson<HistoryEntry[]>(HISTORY_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => b.at - a.at);
}

export function recordHistory(pollId: string, name: string, role: 'created' | 'voted'): void {
  const list = getHistory().filter((e) => e.pollId !== pollId || e.role !== role);
  // 'created' outranks 'voted' for the same poll — don't show it twice.
  const deduped = role === 'created' ? list.filter((e) => e.pollId !== pollId) : list;
  if (deduped.some((e) => e.pollId === pollId && e.role === 'created')) {
    writeStoredJson(HISTORY_KEY, deduped);
    return;
  }
  deduped.unshift({ pollId, name, role, at: Date.now() });
  writeStoredJson(HISTORY_KEY, deduped.slice(0, 100));
}

export function getRememberedVoterName(): string {
  return readStored(VOTER_NAME_KEY) ?? '';
}

export function rememberVoterName(name: string): void {
  if (name.trim()) writeStored(VOTER_NAME_KEY, name.trim());
}
