import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readStored, writeStored } from './storage';

export type Lang = 'en' | 'es';

const LANG_KEY = 'rcv-lang';

const en = {
  // App shell
  appName: 'Ranked-Choice Voting',
  newPoll: '+ New poll',
  demoBanner: 'Demo mode — polls are saved only in this browser. Connect Firebase to share polls by link.',
  languageLabel: 'Language',

  // Home: create form
  createTitle: 'Create a Ranked-Choice Poll',
  createSubtitle: 'Add at least two options, then share the link — no accounts needed to vote.',
  pollNameLabel: 'Poll name',
  optional: '(optional)',
  pollNamePlaceholder: 'e.g. Where should we eat Friday?',
  optionsLabel: 'Options',
  addOptionPlaceholder: 'Add an option…',
  addOption: 'Add Option',
  removeOption: 'Remove {name}',
  minTwoOptions: 'Add at least two options to create the poll.',
  visibilityLabel: 'Results visibility',
  visLiveTitle: 'Live results',
  visLiveDesc: 'Anyone with the link can watch results as votes come in.',
  visHiddenTitle: 'Hidden until closed',
  visHiddenDesc: 'Results stay sealed until you close the poll — avoids bandwagon voting.',
  createBtn: 'Create Poll & Get Link →',
  creating: 'Creating…',
  createError: 'Could not create the poll. Try again.',

  // Home: how it works
  howTitle: 'How it works',
  howSubtitle: 'Fair group decisions in four steps.',
  howStep1T: 'Create a poll',
  howStep1D: 'Type the options you’re choosing between — restaurants, movies, weekend plans, anything.',
  howStep2T: 'Share the link',
  howStep2D: 'Send it to the group chat. Friends open it on their phones and vote — no app, no sign-up.',
  howStep3T: 'Everyone ranks',
  howStep3D: 'Instead of picking just one, each person orders the options from favorite to least favorite.',
  howStep4T: 'See who really wins',
  howStep4D: 'Rankings reveal the option the group agrees on most — not just the one with the loudest fans. Close the poll to lock in the final result.',

  // Home: history
  yourPolls: 'Your polls',
  yourPollsDesc: 'Polls this device created or voted in. Anyone else needs the link.',
  roleCreated: 'Created',
  roleVoted: 'Voted',

  // Poll page
  loadingPoll: 'Loading poll…',
  notFound: 'Poll not found',
  notFoundDesc: 'Double-check the link — or the poll may have been created on another server.',
  createYourOwn: 'Create your own poll',
  backHome: '← Back home',
  statusOpen: '● Open',
  statusClosed: 'Closed',
  votesSoFar_one: '{n} vote so far',
  votesSoFar_other: '{n} votes so far',
  resultsHiddenNote: 'Results are hidden until the poll closes.',
  untitledPoll: 'Untitled Poll',
  dragHint: 'Drag the ⠿ handle or use the arrows — top is your 1st choice.',
  shuffleNote: 'Options are shown in random order to keep the vote fair.',
  passingPhone: 'Passing the phone — this is a fresh ballot for the next person.',
  yourName: 'Your name',
  namePlaceholder: 'Shown next to your vote in results',
  submitVote: 'Submit Vote',
  updateVote: 'Update Vote',
  submitting: 'Submitting…',
  cancel: 'Cancel',
  voteIn: '✓ Your vote is in',
  ballotAdded: '✓ Ballot added!',
  votingAs: 'Voting as {name} — ',
  yourFirstChoice: 'your 1st choice: ',
  handPhone: '🤝 Hand phone to next voter',
  changeVote: 'Change my vote',
  votingEnded: 'Voting has ended',
  ballotCounted: ' — your ballot was counted',
  seeResults: 'See results →',
  resultsWhenClosed: '🔒 Results will be revealed when the poll closes.',
  creatorNoteOpen: 'You created this poll — close it to finalize results.',
  creatorNoteClosed: 'You created this poll.',
  closeVoting: 'Close voting',
  reopenVoting: 'Reopen voting',
  closeConfirm: 'Close voting? Voters will no longer be able to submit or change ballots.',
  errSubmitRetry: "Couldn't submit your vote — please tap Submit again.",
  errPollClosed: 'This poll has closed — votes can no longer be submitted.',
  errNetwork: "Couldn't submit your vote — check your connection and try again.",
  errUpdatePoll: 'Could not update the poll.',

  // Share bar
  shareCreated: '🎉 Poll created — send this link to your voters:',
  copyLink: 'Copy link',
  copied: '✓ Copied',
  shareBtn: 'Share…',
  copyPrompt: 'Copy this link:',

  // Results page
  backToPoll: '← Back to poll',
  loadingResults: 'Loading results…',
  sealedTitle: 'Results are sealed',
  sealedDesc: 'The poll creator chose to hide results until voting closes. Check back once the poll is closed.',
  noVotesYet: 'No votes yet — share the poll link to collect ballots.',
  votingStillOpen: ' · voting still open',
  isLeading: '{name} is leading',
  winsBanner: '{name} wins',
  tiedBanner: '{names} are tied',
  and: ' and ',
  ballotsRounds_one: '{n} ballot · resolved in {r} round{rs}',
  ballotsRounds_other: '{n} ballots · resolved in {r} round{rs}',
  ballotsPoints_one: '{n} ballot · {p} of {max} possible points',
  ballotsPoints_other: '{n} ballots · {p} of {max} possible points',
  countingMethod: 'Counting method:',
  methodIrv: 'Ranked Choice (IRV)',
  methodBorda: 'Borda Count',
  irvBlurb: 'Eliminates the weakest candidate round by round until one has a majority of active votes.',
  irvBest:
    'Best for single-winner decisions where majority support matters most — it prevents vote-splitting between similar options and guarantees the winner is acceptable to over half of voters, but it can ignore a candidate’s broad appeal if they rarely get 1st-place votes.',
  bordaBlurb: 'Every ranked position earns points (1st choice earns the most); highest total wins.',
  bordaBest:
    'Best for consensus decisions — a candidate nobody loves but nobody hates can beat one a slim majority ranks 1st but everyone else ranks last. Good for group picks and prioritization, but easier to game by strategically burying rivals.',
  bestFor: 'Best for: ',
  cardSankeyTitle: 'Round-by-Round Elimination',
  cardSankeySub: 'How votes moved as candidates were eliminated',
  cardFirstTitle: '1st-Choice Votes',
  cardFirstSub: 'Initial preference distribution before any elimination',
  cardFinalTitle: 'Final Round',
  cardFinalSub: 'Vote share among the last candidates standing',
  cardRoundsTitle: 'Round Summary',
  cardRoundsSub: 'Step-by-step breakdown of every elimination round',
  cardPointsTitle: 'Points by Rank',
  cardPointsSub: 'Each candidate’s total, broken down by which ranked position earned it',
  cardStandingsTitle: 'Final Standings',
  cardStandingsSub: 'Every candidate, ranked by total points',
  whoVoted: 'Who voted',
  whoVotedSub: 'Tap a name to see how they ranked every option. Names were optional.',
  anonymousVoter: 'Anonymous',
  votes: 'votes',

  // Round summary
  roundN: 'Round {n}',
  activeVotes_one: '{n} active vote',
  activeVotes_other: '{n} active votes',
  exhaustedCount: ' · {n} exhausted',
  winsWith: '🏆 {name} wins with {v} of {t} votes ({pct}%).',
  eliminatedWith: 'is eliminated with the fewest votes ({v}). ',
  votesTransfer: 'Votes transfer: {list}. ',
  noFurtherPref: 'no further preference (exhausted)',
  currentLeader: 'Current leader: {name}.',
  noOne: 'No one',

  // Borda summary / chart
  pts: '{n} pts',
  maxPossible: 'Max possible: {max} points (every voter ranking a candidate 1st, out of {n} ballot{s}).',
  nthChoicePts: '{ord}-choice votes',

  // Sankey
  exhausted: 'Exhausted',
  transferred: ' (transferred)',
  notEnoughRounds: 'Not enough rounds to visualize yet.',
  sankeyAria: 'Sankey diagram of vote transfers across rounds',
  voteWord_one: '{n} vote',
  voteWord_other: '{n} votes',

  // Ranking list
  dragAria: 'Drag to move {name}',
  moveUpAria: 'Move {name} up',
  moveDownAria: 'Move {name} down',

  // Voting-not-open placeholder page states
  demoResultsNote: '',
};

const es: typeof en = {
  appName: 'Votación Preferencial',
  newPoll: '+ Nueva encuesta',
  demoBanner: 'Modo demo — las encuestas se guardan solo en este navegador. Conecta Firebase para compartir por enlace.',
  languageLabel: 'Idioma',

  createTitle: 'Crea una Votación Preferencial',
  createSubtitle: 'Agrega al menos dos opciones y comparte el enlace — nadie necesita cuenta para votar.',
  pollNameLabel: 'Nombre de la encuesta',
  optional: '(opcional)',
  pollNamePlaceholder: 'p. ej. ¿Dónde comemos el viernes?',
  optionsLabel: 'Opciones',
  addOptionPlaceholder: 'Agregar una opción…',
  addOption: 'Agregar',
  removeOption: 'Eliminar {name}',
  minTwoOptions: 'Agrega al menos dos opciones para crear la encuesta.',
  visibilityLabel: 'Visibilidad de resultados',
  visLiveTitle: 'Resultados en vivo',
  visLiveDesc: 'Cualquiera con el enlace puede ver los resultados mientras llegan los votos.',
  visHiddenTitle: 'Ocultos hasta cerrar',
  visHiddenDesc: 'Los resultados quedan sellados hasta que cierres la encuesta — evita el voto en manada.',
  createBtn: 'Crear encuesta y obtener enlace →',
  creating: 'Creando…',
  createError: 'No se pudo crear la encuesta. Intenta de nuevo.',

  howTitle: 'Cómo funciona',
  howSubtitle: 'Decisiones justas en grupo, en cuatro pasos.',
  howStep1T: 'Crea una encuesta',
  howStep1D: 'Escribe las opciones entre las que van a elegir — restaurantes, películas, planes, lo que sea.',
  howStep2T: 'Comparte el enlace',
  howStep2D: 'Envíalo al chat del grupo. Cada quien lo abre en su teléfono y vota — sin app y sin registrarse.',
  howStep3T: 'Todos ordenan sus preferencias',
  howStep3D: 'En vez de elegir solo una, cada persona ordena las opciones de la más a la menos favorita.',
  howStep4T: 'Descubre quién gana de verdad',
  howStep4D: 'El ranking revela la opción con la que el grupo está más de acuerdo — no solo la que tiene los fans más ruidosos. Cierra la encuesta para fijar el resultado final.',

  yourPolls: 'Tus encuestas',
  yourPollsDesc: 'Encuestas que este dispositivo creó o en las que votó. Los demás necesitan el enlace.',
  roleCreated: 'Creada',
  roleVoted: 'Votada',

  loadingPoll: 'Cargando encuesta…',
  notFound: 'Encuesta no encontrada',
  notFoundDesc: 'Revisa el enlace — o quizá la encuesta se creó en otro servidor.',
  createYourOwn: 'Crea tu propia encuesta',
  backHome: '← Volver al inicio',
  statusOpen: '● Abierta',
  statusClosed: 'Cerrada',
  votesSoFar_one: '{n} voto hasta ahora',
  votesSoFar_other: '{n} votos hasta ahora',
  resultsHiddenNote: 'Los resultados están ocultos hasta que cierre la encuesta.',
  untitledPoll: 'Encuesta sin nombre',
  dragHint: 'Arrastra el símbolo ⠿ o usa las flechas — arriba va tu 1.ª opción.',
  shuffleNote: 'Las opciones aparecen en orden aleatorio para que la votación sea justa.',
  passingPhone: 'Pasando el teléfono — esta es una papeleta nueva para la siguiente persona.',
  yourName: 'Tu nombre',
  namePlaceholder: 'Aparece junto a tu voto en los resultados',
  submitVote: 'Enviar voto',
  updateVote: 'Actualizar voto',
  submitting: 'Enviando…',
  cancel: 'Cancelar',
  voteIn: '✓ Tu voto quedó registrado',
  ballotAdded: '✓ ¡Papeleta agregada!',
  votingAs: 'Votando como {name} — ',
  yourFirstChoice: 'tu 1.ª opción: ',
  handPhone: '🤝 Pasar el teléfono al siguiente',
  changeVote: 'Cambiar mi voto',
  votingEnded: 'La votación terminó',
  ballotCounted: ' — tu voto fue contado',
  seeResults: 'Ver resultados →',
  resultsWhenClosed: '🔒 Los resultados se revelarán cuando cierre la encuesta.',
  creatorNoteOpen: 'Tú creaste esta encuesta — ciérrala para finalizar los resultados.',
  creatorNoteClosed: 'Tú creaste esta encuesta.',
  closeVoting: 'Cerrar votación',
  reopenVoting: 'Reabrir votación',
  closeConfirm: '¿Cerrar la votación? Ya nadie podrá enviar ni cambiar su voto.',
  errSubmitRetry: 'No se pudo enviar tu voto — toca Enviar de nuevo.',
  errPollClosed: 'Esta encuesta ya cerró — ya no se aceptan votos.',
  errNetwork: 'No se pudo enviar tu voto — revisa tu conexión e intenta de nuevo.',
  errUpdatePoll: 'No se pudo actualizar la encuesta.',

  shareCreated: '🎉 Encuesta creada — envía este enlace a los votantes:',
  copyLink: 'Copiar enlace',
  copied: '✓ Copiado',
  shareBtn: 'Compartir…',
  copyPrompt: 'Copia este enlace:',

  backToPoll: '← Volver a la encuesta',
  loadingResults: 'Cargando resultados…',
  sealedTitle: 'Resultados sellados',
  sealedDesc: 'Quien creó la encuesta decidió ocultar los resultados hasta que cierre la votación. Vuelve cuando esté cerrada.',
  noVotesYet: 'Aún no hay votos — comparte el enlace para recibir papeletas.',
  votingStillOpen: ' · votación aún abierta',
  isLeading: '{name} va ganando',
  winsBanner: '{name} gana',
  tiedBanner: '{names} están empatados',
  and: ' y ',
  ballotsRounds_one: '{n} papeleta · resuelto en {r} ronda{rs}',
  ballotsRounds_other: '{n} papeletas · resuelto en {r} ronda{rs}',
  ballotsPoints_one: '{n} papeleta · {p} de {max} puntos posibles',
  ballotsPoints_other: '{n} papeletas · {p} de {max} puntos posibles',
  countingMethod: 'Método de conteo:',
  methodIrv: 'Preferencial (IRV)',
  methodBorda: 'Conteo Borda',
  irvBlurb: 'Elimina al candidato más débil ronda por ronda hasta que uno logra mayoría de los votos activos.',
  irvBest:
    'Ideal para decisiones con un solo ganador donde importa la mayoría — evita dividir el voto entre opciones parecidas y garantiza que el ganador sea aceptable para más de la mitad, aunque puede ignorar a un candidato con amplio apoyo si pocas veces es primera opción.',
  bordaBlurb: 'Cada posición del ranking da puntos (la 1.ª opción da más); gana el total más alto.',
  bordaBest:
    'Ideal para decisiones de consenso — un candidato que nadie ama pero nadie odia puede vencer a uno que una mayoría estrecha pone primero y el resto pone último. Bueno para elegir en grupo y priorizar, pero más fácil de manipular hundiendo rivales a propósito.',
  bestFor: 'Ideal para: ',
  cardSankeyTitle: 'Eliminación ronda por ronda',
  cardSankeySub: 'Cómo se movieron los votos al eliminar candidatos',
  cardFirstTitle: 'Votos de 1.ª opción',
  cardFirstSub: 'Distribución inicial de preferencias antes de eliminar',
  cardFinalTitle: 'Ronda final',
  cardFinalSub: 'Reparto de votos entre los últimos candidatos en pie',
  cardRoundsTitle: 'Resumen por rondas',
  cardRoundsSub: 'Desglose paso a paso de cada ronda de eliminación',
  cardPointsTitle: 'Puntos por posición',
  cardPointsSub: 'El total de cada candidato, desglosado según la posición que lo generó',
  cardStandingsTitle: 'Clasificación final',
  cardStandingsSub: 'Todos los candidatos, ordenados por puntos totales',
  whoVoted: 'Quiénes votaron',
  whoVotedSub: 'Toca un nombre para ver cómo ordenó todas las opciones. Dar el nombre era opcional.',
  anonymousVoter: 'Anónimo',
  votes: 'votos',

  roundN: 'Ronda {n}',
  activeVotes_one: '{n} voto activo',
  activeVotes_other: '{n} votos activos',
  exhaustedCount: ' · {n} agotados',
  winsWith: '🏆 {name} gana con {v} de {t} votos ({pct}%).',
  eliminatedWith: 'queda fuera con menos votos ({v}). ',
  votesTransfer: 'Los votos pasan: {list}. ',
  noFurtherPref: 'sin más preferencias (agotado)',
  currentLeader: 'Líder actual: {name}.',
  noOne: 'Nadie',

  pts: '{n} pts',
  maxPossible: 'Máximo posible: {max} puntos (si cada votante pusiera al candidato de 1.º, con {n} papeleta{s}).',
  nthChoicePts: 'votos de {ord} opción',

  exhausted: 'Agotados',
  transferred: ' (transferido)',
  notEnoughRounds: 'Aún no hay suficientes rondas para visualizar.',
  sankeyAria: 'Diagrama de Sankey de transferencias de votos entre rondas',
  voteWord_one: '{n} voto',
  voteWord_other: '{n} votos',

  dragAria: 'Arrastra para mover {name}',
  moveUpAria: 'Subir {name}',
  moveDownAria: 'Bajar {name}',

  demoResultsNote: '',
};

const dicts: Record<Lang, typeof en> = { en, es };

export type TKey = keyof typeof en;

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  /** Pluralizing t: looks up `${key}_one` or `${key}_other` by count (passed as {n}). */
  tn: (key: string, n: number, params?: Record<string, string | number>) => string;
  /** "1st"/"2nd"… or "1º"/"2º"… for rank badges. */
  rank: (index: number) => string;
  /** "1st"/"2nd" or "1.ª"/"2.ª" for Borda choice labels. */
  ordinal: (n: number) => string;
}

function detectLang(): Lang {
  const stored = readStored(LANG_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  // Walk the browser's full preference list, not just the top entry: a phone
  // set to "English (US), Español" should land on English, while one set to
  // "Français, Español" should still get Spanish rather than the en fallback.
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
  for (const pref of prefs) {
    const code = pref.toLowerCase();
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const dict = dicts[lang];
    const t: I18n['t'] = (key, params) => interpolate(dict[key] ?? en[key] ?? key, params);
    return {
      lang,
      setLang: (l) => {
        // State first, persistence second: if storage is unavailable (private
        // browsing, in-app browsers) the switch must still take effect for
        // this session rather than appearing to do nothing.
        setLangState(l);
        writeStored(LANG_KEY, l);
      },
      t,
      tn: (key, n, params) => {
        const full = `${key}_${n === 1 ? 'one' : 'other'}` as TKey;
        return interpolate((dict[full] as string) ?? (en[full] as string) ?? key, { n, ...params });
      },
      rank: (index) => {
        if (lang === 'es') return `${index + 1}º`;
        const labels = ['1st', '2nd', '3rd'];
        return labels[index] ?? `${index + 1}th`;
      },
      ordinal: (n) => {
        if (lang === 'es') return `${n}.ª`;
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
