/**
 * Quiz engine — filtering, shuffle, session, grading.
 * Keeps question schema normalization centralized for future banks.
 */

export const TYPE_LABELS = {
  mcq: "MCQ",
  decode: "Decode",
  mnemonic: "Mnemonic",
  scenario: "Scenario",
};

export const TYPE_META = {
  mcq: { label: "MCQ", short: "MCQ" },
  decode: { label: "Weather decode", short: "Decode" },
  mnemonic: { label: "Mnemonic", short: "Mnemonic" },
  scenario: { label: "Scenario risk", short: "Scenario" },
};

export const LETTERS = ["A", "B", "C", "D"];

/** Normalize a bank item so renderers can rely on consistent fields. */
export function normalizeQuestion(q) {
  const type = q.type || "mcq";
  return {
    ...q,
    type,
    pack: q.pack || null,
    handbook: q.handbook || null,
    chapter: q.chapter ?? null,
    chapterTitle: q.chapterTitle || null,
    topic: q.topic || "General",
    acsCode: q.acsCode || null,
    question: q.question || "",
    explanation: q.explanation || "",
    choices: q.choices || null,
    correct: q.correct ?? null,
    promptBlock: q.promptBlock || null,
    scenario: q.scenario || null,
    mnemonic: q.mnemonic || null,
    letterLabels: q.letterLabels || null,
    answers: q.answers || null,
  };
}

export function isChoiceType(q) {
  const t = q.type || "mcq";
  return t === "mcq" || t === "decode" || t === "scenario";
}

export function mnemonicLetters(q) {
  if (q.letterLabels) return q.letterLabels.slice();
  return String(q.mnemonic || "").split("");
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9&+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function acceptList(entry) {
  return Array.isArray(entry) ? entry : [entry];
}

/** Forgiving match: exact normalized, or either side contains the other. */
export function answerMatches(user, acceptable) {
  const u = normalizeAnswer(user);
  if (!u) return false;
  return acceptList(acceptable).some((a) => {
    const n = normalizeAnswer(a);
    if (!n) return false;
    return u === n || u.includes(n) || n.includes(u);
  });
}

export function filterBank(bank, { topic = "all", type = "all", pack = "all" } = {}) {
  return bank.filter((q) => {
    if (pack !== "all" && pack && q.pack !== pack) return false;
    if (topic !== "all" && q.topic !== topic) return false;
    if (type !== "all" && (q.type || "mcq") !== type) return false;
    return true;
  });
}

export function bankStats(bank) {
  const byType = { mcq: 0, decode: 0, mnemonic: 0, scenario: 0 };
  const byTopic = {};
  const byPack = {};
  bank.forEach((q) => {
    const t = q.type || "mcq";
    if (byType[t] != null) byType[t] += 1;
    byTopic[q.topic || "General"] = (byTopic[q.topic || "General"] || 0) + 1;
    const pk = q.pack || "unknown";
    byPack[pk] = (byPack[pk] || 0) + 1;
  });
  return {
    total: bank.length,
    byType,
    byTopic,
    byPack,
    topics: Object.keys(byTopic).sort(),
  };
}

export function createSession(questions, { mode = "study" } = {}) {
  return {
    questions: questions.map(normalizeQuestion),
    index: 0,
    answers: [],
    mode, // study | exam
    startedAt: Date.now(),
    lastMissed: [],
  };
}

export function currentQuestion(session) {
  return session.questions[session.index];
}

export function recordAnswer(session, record) {
  const existing = session.answers.findIndex(
    (a) => a.questionId === record.questionId
  );
  if (existing >= 0) session.answers[existing] = record;
  else session.answers.push(record);
}

export function gradeChoice(q, selectedIndex) {
  const isCorrect = selectedIndex === q.correct;
  return {
    questionId: q.id,
    selected: selectedIndex,
    correct: q.correct,
    isCorrect,
    question: q,
    userDisplay:
      selectedIndex == null
        ? "—"
        : `${LETTERS[selectedIndex]}. ${q.choices[selectedIndex]}`,
    correctDisplay: `${LETTERS[q.correct]}. ${q.choices[q.correct]}`,
  };
}

export function gradeMnemonic(q, userAnswers) {
  const letters = mnemonicLetters(q);
  const letterResults = letters.map((_, i) =>
    answerMatches(userAnswers[i], q.answers[i])
  );
  const allOk = letterResults.every(Boolean);
  const userDisplay = letters
    .map((L, i) => `${L}: ${userAnswers[i]?.trim() || "—"}`)
    .join("; ");
  const correctDisplay = letters
    .map((L, i) => `${L}: ${acceptList(q.answers[i])[0]}`)
    .join("; ");
  return {
    questionId: q.id,
    selected: userAnswers,
    correct: q.answers,
    isCorrect: allOk,
    letterResults,
    question: q,
    userDisplay,
    correctDisplay,
  };
}

export function sessionScore(session) {
  const total = session.questions.length;
  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const pct = total ? Math.round((correctCount / total) * 100) : 0;
  const missed = session.answers.filter((a) => !a.isCorrect);
  return { total, correctCount, pct, missed };
}

/** Warm, pilot-to-pilot result copy. */
export function scoreMessage(pct, { perfect = false } = {}) {
  if (perfect || pct === 100) {
    return {
      tone: "great",
      title: "Clean sheet",
      blurb: "Checkride energy. Lock it in with another set while it’s hot.",
    };
  }
  if (pct >= 90) {
    return {
      tone: "great",
      title: "Sharp work",
      blurb: "You’re in the green. Glance the misses, then keep drilling.",
    };
  }
  if (pct >= 80) {
    return {
      tone: "good",
      title: "Solid pass territory",
      blurb: "Altitude’s good. Tighten the misses and you’ll feel unstoppable.",
    };
  }
  if (pct >= 70) {
    return {
      tone: "ok",
      title: "Serviceable — keep climbing",
      blurb: "You know more than you miss. Debrief the misses and fly it again.",
    };
  }
  if (pct >= 50) {
    return {
      tone: "low",
      title: "Good data from a hard set",
      blurb: "Treat this like a debrief, not a verdict. Retry the misses first.",
    };
  }
  return {
    tone: "low",
    title: "Foundation day",
    blurb: "Every pro sat here once. Study the explanations, then retry missed.",
  };
}

export function countOptions(poolSize) {
  if (poolSize <= 0) return [];
  const presets = [5, 10, 20, 40, 60].filter((c) => c < poolSize);
  presets.push(poolSize);
  return [...new Set(presets)];
}
