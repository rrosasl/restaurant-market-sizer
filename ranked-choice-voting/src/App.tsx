import { useState } from 'react';
import { motion } from 'framer-motion';
import { PollProvider, usePoll } from './state/PollContext';
import { SetupView } from './components/SetupView';
import { VotingView } from './components/VotingView';
import { ResultsView } from './components/ResultsView';

type Tab = 'setup' | 'voting' | 'results';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'setup', label: 'Setup', icon: '⚙️' },
  { id: 'voting', label: 'Vote', icon: '🗳️' },
  { id: 'results', label: 'Results', icon: '📊' },
];

function TopNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const { poll } = usePoll();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 shrink items-center gap-2">
          <span className="text-xl">🗳️</span>
          <span className="hidden truncate font-semibold tracking-tight text-slate-900 min-[380px]:inline dark:text-slate-100">
            Ranked-Choice Voting
          </span>
        </div>

        <nav className="relative flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 p-1 sm:gap-1 dark:bg-slate-800/70">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const disabled = tab.id === 'voting' && poll.status !== 'voting';
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(tab.id)}
                title={disabled ? 'Start voting from the Setup tab first' : undefined}
                className={`relative rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${
                  isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-tab-pill"
                    className="absolute inset-0 rounded-full bg-brand-600 shadow-sm shadow-brand-600/30"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <span aria-hidden>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('setup');

  return (
    <div className="min-h-full">
      <TopNav activeTab={activeTab} onChange={setActiveTab} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'setup' && <SetupView onStarted={() => setActiveTab('voting')} />}
          {activeTab === 'voting' && <VotingView onFinishVoting={() => setActiveTab('results')} />}
          {activeTab === 'results' && <ResultsView />}
        </motion.div>
      </main>
    </div>
  );
}

function App() {
  return (
    <PollProvider>
      <AppShell />
    </PollProvider>
  );
}

export default App;
