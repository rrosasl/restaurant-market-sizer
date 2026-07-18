import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { Ballot, Poll } from '../types';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initialPoll(): Poll {
  return {
    id: makeId('poll'),
    name: '',
    options: [],
    status: 'setup',
    ballots: [],
  };
}

type Action =
  | { type: 'SET_NAME'; name: string }
  | { type: 'ADD_OPTION'; name: string }
  | { type: 'REMOVE_OPTION'; id: string }
  | { type: 'RENAME_OPTION'; id: string; name: string }
  | { type: 'START_VOTING' }
  | { type: 'SUBMIT_BALLOT'; ranking: string[] }
  | { type: 'RESET_POLL' };

function reducer(poll: Poll, action: Action): Poll {
  switch (action.type) {
    case 'SET_NAME':
      return { ...poll, name: action.name };
    case 'ADD_OPTION':
      if (!action.name.trim()) return poll;
      return {
        ...poll,
        options: [...poll.options, { id: makeId('opt'), name: action.name.trim() }],
      };
    case 'REMOVE_OPTION':
      return { ...poll, options: poll.options.filter((o) => o.id !== action.id) };
    case 'RENAME_OPTION':
      return {
        ...poll,
        options: poll.options.map((o) => (o.id === action.id ? { ...o, name: action.name } : o)),
      };
    case 'START_VOTING':
      if (poll.options.length < 2) return poll;
      return { ...poll, status: 'voting' };
    case 'SUBMIT_BALLOT': {
      const ballot: Ballot = {
        id: makeId('ballot'),
        ranking: action.ranking,
        submittedAt: Date.now(),
      };
      return { ...poll, ballots: [...poll.ballots, ballot] };
    }
    case 'RESET_POLL':
      return initialPoll();
    default:
      return poll;
  }
}

interface PollContextValue {
  poll: Poll;
  setName: (name: string) => void;
  addOption: (name: string) => void;
  removeOption: (id: string) => void;
  renameOption: (id: string, name: string) => void;
  startVoting: () => void;
  submitBallot: (ranking: string[]) => void;
  resetPoll: () => void;
}

const PollContext = createContext<PollContextValue | null>(null);

export function PollProvider({ children }: { children: ReactNode }) {
  const [poll, dispatch] = useReducer(reducer, undefined, initialPoll);

  const value = useMemo<PollContextValue>(
    () => ({
      poll,
      setName: (name) => dispatch({ type: 'SET_NAME', name }),
      addOption: (name) => dispatch({ type: 'ADD_OPTION', name }),
      removeOption: (id) => dispatch({ type: 'REMOVE_OPTION', id }),
      renameOption: (id, name) => dispatch({ type: 'RENAME_OPTION', id, name }),
      startVoting: () => dispatch({ type: 'START_VOTING' }),
      submitBallot: (ranking) => dispatch({ type: 'SUBMIT_BALLOT', ranking }),
      resetPoll: () => dispatch({ type: 'RESET_POLL' }),
    }),
    [poll],
  );

  return <PollContext.Provider value={value}>{children}</PollContext.Provider>;
}

export function usePoll(): PollContextValue {
  const ctx = useContext(PollContext);
  if (!ctx) throw new Error('usePoll must be used within a PollProvider');
  return ctx;
}
