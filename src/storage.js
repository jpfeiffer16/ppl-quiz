/**
 * Lightweight localStorage persistence — foundation for filters, streaks,
 * and later spaced repetition / multi-bank progress.
 */

const KEY = "ppl-quiz:v2";

const DEFAULTS = {
  filters: {
    pack: "notes",
    topic: "all",
    type: "all",
    count: "10",
    mode: "study", // study | exam
  },
  stats: {
    sessionsCompleted: 0,
    streak: 0,
    lastSessionDate: null, // YYYY-MM-DD in local TZ
    lastScore: null, // { pct, correct, total, at }
    bestPct: null,
  },
};

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadState() {
  const parsed = safeParse(localStorage.getItem(KEY));
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(DEFAULTS);
  }
  return {
    filters: { ...DEFAULTS.filters, ...(parsed.filters || {}) },
    stats: { ...DEFAULTS.stats, ...(parsed.stats || {}) },
  };
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function saveFilters(filters) {
  const state = loadState();
  state.filters = { ...state.filters, ...filters };
  saveState(state);
  return state;
}

/** Local calendar date YYYY-MM-DD (box is America/New_York). */
export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Record a finished session. Updates streak (calendar-day consecutive),
 * last score, best %, and session count.
 */
export function recordSession({ pct, correct, total }) {
  const state = loadState();
  const today = todayKey();
  const { lastSessionDate, streak } = state.stats;

  let nextStreak = 1;
  if (lastSessionDate === today) {
    nextStreak = Math.max(1, streak || 1);
  } else if (lastSessionDate === yesterdayKey()) {
    nextStreak = (streak || 0) + 1;
  }

  state.stats.sessionsCompleted = (state.stats.sessionsCompleted || 0) + 1;
  state.stats.streak = nextStreak;
  state.stats.lastSessionDate = today;
  state.stats.lastScore = {
    pct,
    correct,
    total,
    at: new Date().toISOString(),
  };
  if (state.stats.bestPct == null || pct > state.stats.bestPct) {
    state.stats.bestPct = pct;
  }
  saveState(state);
  return state.stats;
}
