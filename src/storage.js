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
    topicStats: {}, // { [topic]: { seen, correct } }
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

/** Coerce topicStats map; ignore junk from older / corrupt saves. */
function normalizeTopicStats(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [topic, entry] of Object.entries(raw)) {
    if (typeof topic !== "string" || !topic.trim()) continue;
    if (!entry || typeof entry !== "object") continue;
    const seen = Math.max(0, Math.floor(Number(entry.seen) || 0));
    if (seen === 0) continue;
    let correct = Math.max(0, Math.floor(Number(entry.correct) || 0));
    if (correct > seen) correct = seen;
    out[topic] = { seen, correct };
  }
  return out;
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
      topicStats: normalizeTopicStats(statsIn.topicStats),
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
 * Apply per-topic seen/correct increments from finished-session answer records.
 * Each answered question bumps its topic once.
 */
function applyTopicStats(topicStats, answers) {
  if (!Array.isArray(answers) || !answers.length) return topicStats;
  const next = { ...topicStats };
  for (const a of answers) {
    if (!a || typeof a !== "object") continue;
    const topic =
      (a.question && typeof a.question.topic === "string" && a.question.topic) ||
      (typeof a.topic === "string" && a.topic) ||
      "General";
    const key = topic.trim() || "General";
    const prev = next[key] || { seen: 0, correct: 0 };
    const seen = (prev.seen || 0) + 1;
    const correct = (prev.correct || 0) + (a.isCorrect ? 1 : 0);
    next[key] = { seen, correct };
  }
  return next;
}

/**
 * Topics with lowest accuracy among those with enough samples.
 * Prefer seen >= 3; fall back to seen >= 2 if that yields nothing.
 * Returns up to `limit` entries: { topic, seen, correct, accuracy }.
 */
export function weakTopics(topicStats, limit = 3) {
  const map = normalizeTopicStats(topicStats);
  const entries = Object.entries(map).map(([topic, { seen, correct }]) => ({
    topic,
    seen,
    correct,
    accuracy: seen > 0 ? correct / seen : 1,
  }));
  let pool = entries.filter((e) => e.seen >= 3);
  if (!pool.length) pool = entries.filter((e) => e.seen >= 2);
  pool.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    if (a.seen !== b.seen) return b.seen - a.seen; // more evidence first on ties
    return a.topic.localeCompare(b.topic);
  });
  return pool.slice(0, Math.max(0, limit));
}

/**
 * Record a finished session. Updates streak (calendar-day consecutive),
 * last score, best %, session count, last misses, and per-topic mastery.
 */
export function recordSession({ pct, correct, total, missedIds, answers }) {
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
  state.stats.topicStats = applyTopicStats(
    normalizeTopicStats(state.stats.topicStats),
    answers
  );
  saveState(state);
  return state.stats;
}
