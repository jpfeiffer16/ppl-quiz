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
    chapter: "all", // "all" or handbook:number, e.g. "PHAK:3"
    count: "10",
    mode: "study", // study | exam
  },
  stats: {
    sessionsCompleted: 0,
    streak: 0,
    lastSessionDate: null, // YYYY-MM-DD in local TZ
    lastScore: null, // { pct, correct, total, at }
    bestPct: null,
    lastMissedIds: [], // question ids from the last finished session
    lastMissedLabel: null, // short count label, e.g. "3 misses"
  },
};

const MISSED_CAP = 40;

/** Keep a short, unique list of question ids. Drops junk from older saves. */
function normalizeMissedIds(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    let id = null;
    if (typeof raw === "number" && Number.isFinite(raw)) id = raw;
    else if (typeof raw === "string" && /^\d+$/.test(raw)) id = Number(raw);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MISSED_CAP) break;
  }
  return out;
}

function missedLabel(count) {
  if (!count) return null;
  return count === 1 ? "1 miss" : `${count} misses`;
}

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
  const statsIn = parsed.stats || {};
  const lastMissedIds = normalizeMissedIds(statsIn.lastMissedIds);
  return {
    filters: { ...DEFAULTS.filters, ...(parsed.filters || {}) },
    stats: {
      ...DEFAULTS.stats,
      ...statsIn,
      lastMissedIds,
      lastMissedLabel: lastMissedIds.length
        ? (typeof statsIn.lastMissedLabel === "string" && statsIn.lastMissedLabel
            ? statsIn.lastMissedLabel
            : missedLabel(lastMissedIds.length))
        : null,
    },
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
export function recordSession({ pct, correct, total, missedIds }) {
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
  // missedIds present (including []) replaces the saved drill. Omit to leave it.
  // A perfect session passes [] and clears the home "practice misses" button.
  if (Array.isArray(missedIds)) {
    const ids = normalizeMissedIds(missedIds);
    state.stats.lastMissedIds = ids;
    state.stats.lastMissedLabel = missedLabel(ids.length);
  }
  saveState(state);
  return state.stats;
}
