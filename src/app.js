/**
 * PPL Quiz — UI wiring.
 * Views: home → quiz → results. Depends on engine + storage + data packs (Notes / PHAK / AFH).
 */

import { bankForPack, PACK_META, ALL_BANKS } from "../data/index.js";
import {
  TYPE_LABELS,
  TYPE_META,
  LETTERS,
  bankStats,
  filterBank,
  shuffle,
  createSession,
  currentQuestion,
  recordAnswer,
  gradeChoice,
  gradeMnemonic,
  sessionScore,
  scoreMessage,
  countOptions,
  isChoiceType,
  mnemonicLetters,
  acceptList,
} from "./engine.js";
import { loadState, saveFilters, recordSession } from "./storage.js";
import { initInstallPrompt } from "./install.js";

/* ── DOM refs ─────────────────────────────────────────────────────────── */

const views = {
  home: document.getElementById("view-home"),
  quiz: document.getElementById("view-quiz"),
  results: document.getElementById("view-results"),
};

const $ = (id) => document.getElementById(id);

const els = {
  bankTotal: $("bank-total"),
  filteredCount: $("filtered-count"),
  typeStats: $("type-stats"),
  topicSelect: $("topic-select"),
  typeChips: $("type-chips"),
  packChips: $("pack-chips"),
  packBlurb: $("pack-blurb"),
  countSelect: $("count-select"),
  modeStudy: $("mode-study"),
  modeExam: $("mode-exam"),
  startBtn: $("start-btn"),
  emptyHint: $("empty-hint"),
  homeStats: $("home-stats"),
  streakChip: $("streak-chip"),
  lastScoreChip: $("last-score-chip"),

  progressText: $("progress-text"),
  progressFill: $("progress-fill"),
  liveScore: $("live-score"),
  quitBtn: $("quit-btn"),
  topicTag: $("topic-tag"),
  acsTag: $("acs-tag"),
  typeTag: $("type-tag"),
  promptBlock: $("prompt-block"),
  questionText: $("question-text"),
  choices: $("choices"),
  mnemonicForm: $("mnemonic-form"),
  mnemonicRows: $("mnemonic-rows"),
  mnemonicSubmit: $("mnemonic-submit"),
  mnemonicFeedback: $("mnemonic-feedback"),
  feedbackPanel: $("feedback-panel"),
  feedbackStatus: $("feedback-status"),
  feedbackExplain: $("feedback-explain"),
  nextBtn: $("next-btn"),
  quizCard: $("quiz-card"),

  scorePct: $("score-pct"),
  scoreTitle: $("score-title"),
  scoreDetail: $("score-detail"),
  scoreBlurb: $("score-blurb"),
  resultsHero: $("results-hero"),
  missedSection: $("missed-section"),
  missedList: $("missed-list"),
  perfectBanner: $("perfect-banner"),
  retryMissedBtn: $("retry-missed-btn"),
  retryAllBtn: $("retry-all-btn"),
  newSetBtn: $("new-set-btn"),
  homeBtn: $("home-btn"),
};

let activeBank = bankForPack("notes");
let stats = bankStats(activeBank);
let session = null;
let answeredThisQ = false;
let selectedPack = "notes";
let selectedType = "all";
let selectedMode = "study";

function setActivePack(packId) {
  selectedPack = packId || "notes";
  activeBank = bankForPack(selectedPack);
  stats = bankStats(activeBank);
}

/* ── Views ────────────────────────────────────────────────────────────── */

function show(view) {
  Object.entries(views).forEach(([name, el]) => {
    const on = name === view;
    el.classList.toggle("active", on);
    el.hidden = !on;
  });
  // Focus management for a11y
  if (view === "home") {
    requestAnimationFrame(() => els.startBtn?.focus({ preventScroll: true }));
  }
}

/* ── Home ─────────────────────────────────────────────────────────────── */

function renderPackChips() {
  els.packChips.innerHTML = PACK_META.map((p) => {
    const n =
      p.id === "all"
        ? ALL_BANKS.length
        : bankStats(bankForPack(p.id)).total;
    const active = p.id === selectedPack;
    return `<button type="button" class="chip chip-pack${active ? " is-active" : ""}" data-pack="${p.id}" aria-pressed="${active}" title="${p.description}"><span class="chip-pack-label">${p.short}</span><span class="chip-pack-n">${n}</span></button>`;
  }).join("");
  const meta = PACK_META.find((p) => p.id === selectedPack);
  if (els.packBlurb && meta) {
    els.packBlurb.textContent = meta.description;
  }
}

function renderTypeStats() {
  const order = ["mcq", "decode", "mnemonic", "scenario"];
  els.typeStats.innerHTML = order
    .map((t) => {
      const n = stats.byType[t] || 0;
      return `<span class="stat-chip" data-type="${t}"><span class="stat-n">${n}</span> ${TYPE_META[t].short}</span>`;
    })
    .join("");
}

function renderTypeChips() {
  const items = [
    { value: "all", label: "All types" },
    ...Object.entries(TYPE_META).map(([value, m]) => ({
      value,
      label: m.label,
    })),
  ];
  els.typeChips.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="chip${item.value === selectedType ? " is-active" : ""}" data-type="${item.value}" aria-pressed="${item.value === selectedType}">${item.label}</button>`
    )
    .join("");
}

function populateTopics(preferred) {
  els.topicSelect.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "All topics";
  els.topicSelect.appendChild(all);
  stats.topics.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = `${t} (${stats.byTopic[t]})`;
    els.topicSelect.appendChild(opt);
  });
  if (preferred && [...els.topicSelect.options].some((o) => o.value === preferred)) {
    els.topicSelect.value = preferred;
  }
}

function currentFilters() {
  return {
    pack: selectedPack,
    topic: els.topicSelect.value,
    type: selectedType,
    count: els.countSelect.value,
    mode: selectedMode,
  };
}

function refreshCountSelect(preferredCount) {
  const pool = filterBank(activeBank, {
    topic: els.topicSelect.value,
    type: selectedType,
  });
  const n = pool.length;
  els.filteredCount.textContent = String(n);
  els.countSelect.innerHTML = "";
  els.startBtn.disabled = n === 0;
  els.emptyHint.hidden = n !== 0;

  if (n === 0) {
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = "No matches";
    els.countSelect.appendChild(opt);
    return;
  }

  const options = countOptions(n);
  const want = preferredCount != null ? String(preferredCount) : null;
  options.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = c === n ? `All ${n}` : String(c);
    els.countSelect.appendChild(opt);
  });

  if (want && options.map(String).includes(want)) {
    els.countSelect.value = want;
  } else {
    const def = Math.min(10, n);
    els.countSelect.value = String(options.includes(def) ? def : n);
  }
}

function renderHomePersistence(saved) {
  const { streak, lastScore, sessionsCompleted } = saved.stats;
  if (streak > 0) {
    els.streakChip.hidden = false;
    els.streakChip.textContent =
      streak === 1 ? "1-day streak" : `${streak}-day streak`;
  } else {
    els.streakChip.hidden = true;
  }

  if (lastScore) {
    els.lastScoreChip.hidden = false;
    els.lastScoreChip.textContent = `Last: ${lastScore.pct}% (${lastScore.correct}/${lastScore.total})`;
  } else {
    els.lastScoreChip.hidden = true;
  }

  els.homeStats.hidden = !(streak > 0 || lastScore || sessionsCompleted > 0);
}

function setMode(mode) {
  selectedMode = mode === "exam" ? "exam" : "study";
  els.modeStudy.classList.toggle("is-active", selectedMode === "study");
  els.modeExam.classList.toggle("is-active", selectedMode === "exam");
  els.modeStudy.setAttribute("aria-pressed", selectedMode === "study");
  els.modeExam.setAttribute("aria-pressed", selectedMode === "exam");
}

function initHome() {
  const saved = loadState();
  const pack = saved.filters.pack || "notes";
  setActivePack(pack);
  selectedType = saved.filters.type || "all";
  setMode(saved.filters.mode || "study");

  els.bankTotal.textContent = String(stats.total);
  renderPackChips();
  renderTypeStats();
  renderTypeChips();
  populateTopics(saved.filters.topic);
  refreshCountSelect(saved.filters.count);
  renderHomePersistence(saved);
}

function persistFilters() {
  saveFilters(currentFilters());
}

/* ── Quiz ─────────────────────────────────────────────────────────────── */

function startQuiz(questions, mode = selectedMode) {
  if (!questions.length) return;
  session = createSession(questions, { mode });
  answeredThisQ = false;
  show("quiz");
  renderQuestion();
}

function startFromHome() {
  persistFilters();
  const pool = filterBank(activeBank, {
    topic: els.topicSelect.value,
    type: selectedType,
  });
  const count = Number(els.countSelect.value) || pool.length;
  if (!pool.length) return;
  startQuiz(shuffle(pool).slice(0, count), selectedMode);
}

function updateProgress() {
  const total = session.questions.length;
  const num = session.index + 1;
  els.progressText.textContent = `${num} of ${total}`;
  els.progressFill.style.width = `${((num - 1) / total) * 100}%`;
  els.progressFill.parentElement.setAttribute(
    "aria-valuenow",
    String(Math.round(((num - 1) / total) * 100))
  );

  if (session.mode === "study") {
    const answered = session.answers.length;
    const correct = session.answers.filter((a) => a.isCorrect).length;
    els.liveScore.hidden = answered === 0;
    els.liveScore.textContent =
      answered === 0 ? "" : `${correct}/${answered} so far`;
  } else {
    els.liveScore.hidden = true;
  }
}

function clearFeedback() {
  els.feedbackPanel.hidden = true;
  els.feedbackStatus.textContent = "";
  els.feedbackExplain.textContent = "";
  els.feedbackPanel.className = "feedback-panel";
}

function showFeedback(isCorrect, explanation) {
  if (session.mode !== "study") return;
  els.feedbackPanel.hidden = false;
  els.feedbackPanel.className =
    "feedback-panel " + (isCorrect ? "is-ok" : "is-bad");
  els.feedbackStatus.textContent = isCorrect ? "Correct" : "Not quite";
  els.feedbackExplain.textContent = explanation || "";
}

function renderQuestion() {
  const q = currentQuestion(session);
  const total = session.questions.length;
  const num = session.index + 1;
  const type = q.type;
  answeredThisQ = false;

  updateProgress();
  // Animate progress to current question fraction after paint
  requestAnimationFrame(() => {
    els.progressFill.style.width = `${(num / total) * 100}%`;
  });

  els.topicTag.textContent = q.topic;
  if (q.acsCode) {
    els.acsTag.hidden = false;
    els.acsTag.textContent = q.acsCode;
  } else if (q.handbook && q.chapter != null) {
    els.acsTag.hidden = false;
    els.acsTag.textContent = `${q.handbook} Ch${q.chapter}`;
  } else {
    els.acsTag.hidden = true;
  }
  els.typeTag.hidden = false;
  els.typeTag.textContent = TYPE_LABELS[type] || type;
  els.typeTag.dataset.type = type;

  els.nextBtn.disabled = true;
  els.nextBtn.textContent = num === total ? "See results" : "Next";
  clearFeedback();
  els.mnemonicFeedback.hidden = true;
  els.mnemonicFeedback.textContent = "";
  els.mnemonicFeedback.className = "mnemonic-feedback";

  // Soft card entrance
  els.quizCard.classList.remove("card-enter");
  void els.quizCard.offsetWidth;
  els.quizCard.classList.add("card-enter");

  if (type === "decode" && q.promptBlock) {
    els.promptBlock.hidden = false;
    els.promptBlock.textContent = q.promptBlock;
    els.promptBlock.classList.add("is-decode");
    els.promptBlock.classList.remove("is-scenario");
  } else if (type === "scenario" && q.scenario) {
    els.promptBlock.hidden = false;
    els.promptBlock.textContent = q.scenario;
    els.promptBlock.classList.add("is-scenario");
    els.promptBlock.classList.remove("is-decode");
  } else {
    els.promptBlock.hidden = true;
    els.promptBlock.textContent = "";
  }

  els.questionText.textContent = q.question;

  if (type === "mnemonic") {
    els.choices.hidden = true;
    els.choices.innerHTML = "";
    els.mnemonicForm.hidden = false;
    renderMnemonic(q);
  } else {
    els.mnemonicForm.hidden = true;
    els.mnemonicRows.innerHTML = "";
    els.choices.hidden = false;
    renderChoices(q);
  }
}

function renderChoices(q) {
  els.choices.innerHTML = "";
  (q.choices || []).forEach((text, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.index = String(i);
    btn.setAttribute("aria-label", `Option ${LETTERS[i]}: ${text}`);
    btn.innerHTML =
      '<span class="choice-letter" aria-hidden="true"></span><span class="choice-text"></span>';
    btn.querySelector(".choice-letter").textContent = LETTERS[i] || String(i + 1);
    btn.querySelector(".choice-text").textContent = text;
    btn.addEventListener("click", () => onSelectChoice(i));
    els.choices.appendChild(btn);
  });
}

function choiceButtons() {
  return [...els.choices.querySelectorAll(".choice")];
}

function onSelectChoice(index) {
  if (answeredThisQ && session.mode === "study") return;
  const q = currentQuestion(session);
  const buttons = choiceButtons();

  if (session.mode === "exam") {
    buttons.forEach((b) => b.classList.remove("selected"));
    buttons[index]?.classList.add("selected");
    const record = gradeChoice(q, index);
    recordAnswer(session, record);
    answeredThisQ = true;
    els.nextBtn.disabled = false;
    return;
  }

  // Study mode — lock + reveal
  answeredThisQ = true;
  const record = gradeChoice(q, index);
  recordAnswer(session, record);

  buttons.forEach((b, i) => {
    b.disabled = true;
    b.classList.remove("selected");
    if (i === index) b.classList.add("selected");
    if (i === q.correct) b.classList.add("is-correct");
    if (i === index && index !== q.correct) b.classList.add("is-wrong");
  });

  showFeedback(record.isCorrect, q.explanation);
  updateProgress();
  els.nextBtn.disabled = false;
  requestAnimationFrame(() => els.nextBtn.focus({ preventScroll: true }));
}

function renderMnemonic(q) {
  const letters = mnemonicLetters(q);
  els.mnemonicRows.innerHTML = "";
  letters.forEach((letter, i) => {
    const row = document.createElement("div");
    row.className = "mnemonic-row";
    row.innerHTML =
      '<span class="mnemonic-letter" aria-hidden="true"></span>' +
      `<input type="text" class="mnemonic-input" autocomplete="off" spellcheck="false" aria-label="Meaning of ${letter}" />`;
    row.querySelector(".mnemonic-letter").textContent = letter;
    const input = row.querySelector(".mnemonic-input");
    input.dataset.index = String(i);
    input.placeholder = `${letter} stands for…`;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const inputs = [...els.mnemonicRows.querySelectorAll(".mnemonic-input")];
        const idx = Number(input.dataset.index);
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else checkMnemonic();
      }
    });
    input.addEventListener("input", () => {
      input.classList.remove("ok", "bad");
    });
    els.mnemonicRows.appendChild(row);
  });
  els.mnemonicSubmit.disabled = false;
  els.mnemonicSubmit.hidden = false;
  const first = els.mnemonicRows.querySelector(".mnemonic-input");
  if (first) setTimeout(() => first.focus(), 40);
}

function checkMnemonic() {
  if (answeredThisQ) return;
  const q = currentQuestion(session);
  const inputs = [...els.mnemonicRows.querySelectorAll(".mnemonic-input")];
  const userAnswers = inputs.map((inp) => inp.value);
  const record = gradeMnemonic(q, userAnswers);

  answeredThisQ = true;
  const study = session.mode === "study";

  inputs.forEach((inp, i) => {
    inp.disabled = true;
    if (study) {
      const ok = record.letterResults[i];
      inp.classList.toggle("ok", ok);
      inp.classList.toggle("bad", !ok);
      if (!ok) {
        const hint = document.createElement("span");
        hint.className = "mnemonic-hint";
        hint.textContent = acceptList(q.answers[i])[0];
        inp.parentElement.appendChild(hint);
      }
    }
  });

  els.mnemonicSubmit.disabled = true;

  if (study) {
    els.mnemonicFeedback.hidden = false;
    if (record.isCorrect) {
      els.mnemonicFeedback.textContent = "Nailed it — every letter matched.";
      els.mnemonicFeedback.className = "mnemonic-feedback ok";
    } else {
      const missed = mnemonicLetters(q)
        .map((L, i) => (record.letterResults[i] ? null : L))
        .filter(Boolean);
      els.mnemonicFeedback.textContent = `Close — check ${missed.join(", ")}. Hints shown under misses.`;
      els.mnemonicFeedback.className = "mnemonic-feedback bad";
    }
    showFeedback(record.isCorrect, q.explanation);
  } else {
    els.mnemonicFeedback.hidden = false;
    els.mnemonicFeedback.textContent = "Answers locked in. Keep going.";
    els.mnemonicFeedback.className = "mnemonic-feedback";
  }

  recordAnswer(session, record);
  updateProgress();
  els.nextBtn.disabled = false;
  requestAnimationFrame(() => els.nextBtn.focus({ preventScroll: true }));
}

function goNext() {
  if (els.nextBtn.disabled) return;
  if (session.index < session.questions.length - 1) {
    session.index += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function quitQuiz() {
  if (!session) {
    show("home");
    return;
  }
  const mid = session.index > 0 || session.answers.length > 0;
  if (mid) {
    const ok = window.confirm(
      "Leave this set? Progress on this quiz won’t be saved."
    );
    if (!ok) return;
  }
  session = null;
  show("home");
  initHome();
}

/* ── Results ──────────────────────────────────────────────────────────── */

function finishQuiz() {
  const { total, correctCount, pct, missed } = sessionScore(session);
  const msg = scoreMessage(pct, { perfect: missed.length === 0 });

  const persisted = recordSession({ pct, correct: correctCount, total });

  els.resultsHero.dataset.tone = msg.tone;
  els.scorePct.textContent = `${pct}%`;
  els.scoreTitle.textContent = msg.title;
  els.scoreDetail.textContent = `${correctCount} of ${total} correct`;
  els.scoreBlurb.textContent = msg.blurb;

  if (persisted.streak > 1) {
    els.scoreBlurb.textContent += ` · ${persisted.streak}-day streak`;
  }

  els.perfectBanner.hidden = missed.length !== 0;
  els.missedList.innerHTML = "";

  if (missed.length === 0) {
    els.missedSection.hidden = true;
    els.retryMissedBtn.disabled = true;
    els.retryMissedBtn.hidden = true;
  } else {
    els.missedSection.hidden = false;
    els.retryMissedBtn.disabled = false;
    els.retryMissedBtn.hidden = false;
    els.retryMissedBtn.textContent =
      missed.length === 1
        ? "Retry 1 miss"
        : `Retry ${missed.length} missed`;
    missed.forEach((m) => els.missedList.appendChild(buildMissedItem(m)));
  }

  session.lastMissed = missed.map((m) => m.question);
  show("results");
  requestAnimationFrame(() => {
    (missed.length ? els.retryMissedBtn : els.newSetBtn).focus({
      preventScroll: true,
    });
  });
}

function buildMissedItem(m) {
  const q = m.question;
  const type = q.type;
  const li = document.createElement("li");
  li.className = "missed-item";

  const meta = document.createElement("div");
  meta.className = "missed-topic";
  meta.textContent = `${q.topic}${q.acsCode ? " · " + q.acsCode : ""} · ${TYPE_LABELS[type] || type}`;
  li.appendChild(meta);

  if (type === "decode" && q.promptBlock) {
    const pre = document.createElement("pre");
    pre.className = "missed-block";
    pre.textContent = q.promptBlock;
    li.appendChild(pre);
  } else if (type === "scenario" && q.scenario) {
    const sc = document.createElement("p");
    sc.className = "missed-scenario";
    sc.textContent = q.scenario;
    li.appendChild(sc);
  }

  const qEl = document.createElement("div");
  qEl.className = "missed-q";
  if (type === "mnemonic" && q.mnemonic) {
    qEl.textContent = `${q.mnemonic} — ${q.question}`;
  } else {
    qEl.textContent = q.question;
  }
  li.appendChild(qEl);

  const ans = document.createElement("div");
  ans.className = "missed-answers";
  ans.innerHTML = `
    <div><span class="label yours">Yours</span> <span class="yours-text"></span></div>
    <div><span class="label correct">Correct</span> <span class="correct-text"></span></div>
  `;
  ans.querySelector(".yours-text").textContent = m.userDisplay || "—";
  ans.querySelector(".correct-text").textContent = m.correctDisplay || "—";
  li.appendChild(ans);

  if (q.explanation) {
    const ex = document.createElement("p");
    ex.className = "missed-explain";
    ex.textContent = q.explanation;
    li.appendChild(ex);
  }
  return li;
}

function retryAll() {
  if (!session) return;
  startQuiz(shuffle(session.questions), session.mode);
}

function retryMissed() {
  if (!session?.lastMissed?.length) return;
  startQuiz(shuffle(session.lastMissed), session.mode);
}

function newSetSameFilters() {
  // Re-roll from last home filters (still in selects / chips)
  startFromHome();
}

/* ── Keyboard ─────────────────────────────────────────────────────────── */

function onGlobalKey(e) {
  if (!views.quiz.classList.contains("active") || !session) return;
  const tag = (e.target && e.target.tagName) || "";
  const typing =
    tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;

  if (e.key === "Escape") {
    e.preventDefault();
    quitQuiz();
    return;
  }

  // Enter advances when answered. Space is left to native focused-control activation
  // so we do not double-fire with the Next button's own keyup click.
  if (!typing && answeredThisQ && e.key === "Enter") {
    if (!els.nextBtn.disabled) {
      e.preventDefault();
      goNext();
    }
    return;
  }

  if (typing || answeredThisQ && session.mode === "study") return;
  if (!isChoiceType(currentQuestion(session))) return;

  const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
  const key = e.key.toLowerCase();
  if (key in map) {
    const idx = map[key];
    const buttons = choiceButtons();
    if (buttons[idx] && !buttons[idx].disabled) {
      e.preventDefault();
      onSelectChoice(idx);
    }
  }
}

/* ── Events ───────────────────────────────────────────────────────────── */

els.startBtn.addEventListener("click", startFromHome);
els.nextBtn.addEventListener("click", goNext);
els.quitBtn.addEventListener("click", quitQuiz);
els.mnemonicSubmit.addEventListener("click", checkMnemonic);
els.retryAllBtn.addEventListener("click", retryAll);
els.retryMissedBtn.addEventListener("click", retryMissed);
els.newSetBtn.addEventListener("click", newSetSameFilters);
els.homeBtn.addEventListener("click", () => {
  session = null;
  show("home");
  initHome();
});

els.topicSelect.addEventListener("change", () => {
  refreshCountSelect();
  persistFilters();
});
els.countSelect.addEventListener("change", persistFilters);

els.packChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn || !btn.dataset.pack) return;
  setActivePack(btn.dataset.pack);
  renderPackChips();
  renderTypeStats();
  els.bankTotal.textContent = String(stats.total);
  populateTopics("all");
  renderTypeChips();
  refreshCountSelect();
  persistFilters();
});

els.typeChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  selectedType = btn.dataset.type;
  renderTypeChips();
  refreshCountSelect();
  persistFilters();
});

els.modeStudy.addEventListener("click", () => {
  setMode("study");
  persistFilters();
});
els.modeExam.addEventListener("click", () => {
  setMode("exam");
  persistFilters();
});

document.addEventListener("keydown", onGlobalKey);

/* ── Service worker (PWA) ─────────────────────────────────────────────── */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const secure =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  if (!secure) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}

/* ── Boot ─────────────────────────────────────────────────────────────── */

registerServiceWorker();
initInstallPrompt();
initHome();
show("home");
