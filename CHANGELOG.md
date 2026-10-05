# Changelog

## Simple geometric logo (2026-10-05)

- Install simple geometric AeroTutor logo (charcoal rounded square, cyan diagonal slash, white top-down plane); icons/header/favicons refreshed; SW cache `ppl-quiz-v9`

## Cessna-style logo (2026-10-05)

- Install recognizable Cessna-style AeroTutor logo; icons/header/favicons refreshed; SW cache `ppl-quiz-v8`

## Bold cyan logo (2026-10-05)

- Bold cyan AeroTutor logo with repaired nose; icons/header/favicons refreshed; SW cache `ppl-quiz-v7`

## Brand logo refresh (2026-10-05)

- Installed fixed first-style AeroTutor logo (no pride / no cyan-slash); icons 192/512 + maskable (~10% pad on `#0b1220`), apple-touch 180, favicons 32/48; header img + favicon links; SW cache `ppl-quiz-v6`


## Per-topic mastery lite (2026-10-05)

- Finished sessions update `stats.topicStats` on `ppl-quiz:v2` — per-topic `{ seen, correct }` for every answered question (backward compatible; old saves load with an empty map)
- Home shows a **Best: N%** chip when `bestPct` is set
- Home **Weak topics** chips: up to 3 lowest-accuracy topics with `seen >= 3` (falls back to `seen >= 2`); tap starts a topic-only drill on the current pack in Study/Exam mode (up to 10 questions)
- Service worker cache bumped to `ppl-quiz-v5`


## Practice last misses (2026-10-04)

- Finished sessions save missed question ids on `ppl-quiz:v2` (`stats.lastMissedIds`, cap 40) plus a short count label
- A perfect session clears that list
- Home shows **Practice N misses** when those ids still exist in the loaded banks, and starts exactly those questions in the current Study/Exam mode (chapter and type filters are not applied)
- Service worker cache bumped to `ppl-quiz-v4`


## Chapter filter (2026-10-03)

- Home screen **Chapter** select lists chapters present on the selected pack (`chapter` + `chapterTitle`)
- Defaults to All chapters; narrows the pool with type, topic, and count and updates the match line
- Saved on the existing `ppl-quiz:v2` filters object (`chapter`, default `"all"` — old saves still load)
- Hidden when the pack has no chapter metadata (Study Notes)
- Service worker cache bumped to `ppl-quiz-v3`


## Install affordance (2026-09-28)

- Native-style **Install app** banner: listens for `beforeinstallprompt`, stashes event, calls `prompt()` + handles `userChoice`
- Hides when already installed (`display-mode: standalone`, `getInstalledRelatedApps`, `appinstalled`)
- Dismissible “Not now” — remembered ~7 days in `localStorage`
- Light iOS Safari hint (Share → Add to Home Screen) when not standalone
- Manifest: `id`, `related_applications` (webapp) for related-apps detection; SW cache bumped to `ppl-quiz-v2` + precaches `src/install.js`

## PWA + public deploy

- Added `manifest.webmanifest`, icons (192/512 + maskable + apple-touch), and `sw.js` offline cache
- Wired theme-color / apple-mobile-web-app meta + SW registration (https/localhost only)
- README: Install on phone steps

## 2026-09-28 — Handbook depth expansion (entire-handbook floor)

### Raised chapter floors
- Target **≥12–15 original items per chapter** for PHAK (1–17) and AFH (1–18)
- **PHAK**: 194 → **248** (mcq 206 · scenario 23 · mnemonic 4 · decode 15)
- **AFH**: 143 → **247** (mcq 209 · scenario 36 · mnemonic 2)
- **Notes**: unchanged at **74** · **All packs**: **569**

### Per-chapter (after)
- **PHAK**: Ch1–11/14–15 = 14 each; Ch12 weather theory = 16; Ch13 weather services = **20** (decode-heavy); Ch16–17 = 15
- **AFH**: Ch1–12/18 = 14 each; transition Ch13–17 = 13 each (was ~5–6)

### Priority fills
- AFH Ch8 traffic patterns 6 → 14 (entries, TPA, base timing, mid-air collision context)
- AFH Ch12 complex 6 → 14 (HP vs complex, flaps, prop/MP order, gear warning)
- AFH Ch13–17 multiengine / tailwheel / turboprop / jet / LSA each 5 → 13
- PHAK Ch13: +8 weather products including METAR/TAF/SPECI/PIREP **decode** sets (RVR, TEMPO, M-temps, +TSRA, etc.)

### Generators
- New `scripts/banks/phak_expand.py` and `scripts/banks/afh_expand.py`
- `scripts/build_banks.py` concatenates base + expand modules
- Rebuild: `python3 scripts/build_banks.py`

### Kept
- Original FAA-handbook-grounded items only (no commercial bank copies)
- UI / Study·Exam joy polish unchanged; server still at http://127.0.0.1:8765/

## 2026-09-28 — Handbook packs (PHAK + AFH)

### Added
- **Multi-pack architecture**: `data/packs.json`, `data/index.js`, `bank-notes.js` / `bank-phak.js` / `bank-afh.js`
- **Pack picker** on home: Notes | PHAK | AFH | All
- **PHAK pack** (started ~194; now see depth expansion): chapters 1–17 of FAA-H-8083-25C
- **AFH pack** (started ~143; now see depth expansion): chapters 1–18 of FAA-H-8083-3C
- **Sources**: chapter PDFs + `pdftotext` extracts under `sources/`; MOSAIC addenda saved
- **Generators**: `scripts/banks/*.py` + `scripts/build_banks.py` for maintainable bank rebuilds
- Storage key bumped to `ppl-quiz:v2` (persists selected pack)

### Kept
- Area I study-notes pack intact as its own bank (74 items)
- Study/Exam mode, joy polish, keyboard shortcuts, streak/score chips

### Coverage notes (superseded by depth expansion above)
- Initial release had thinner AFH transition / pattern chapters; expanded in the depth pass

## 2026-09-28 — Joy pass + foundations

### Audit (pre-polish)
- Home was a flat form: no bank breakdown, no mode choice, no recall of last session
- Quiz had select-then-next with no study feedback; progress felt thin; quit had no confirm
- Results always “green”; missed review mashed METAR/scenario into one blob
- Monolithic `app.js` IIFE — hard to extend for banks / spaced rep / oral mode
- Weak focus styles, limited keyboard support, no persistence

### What changed
- **Study vs Exam mode** — check-as-you-go with explanations, or review-at-end
- **Home** — bank stats by type, chip type filters, mode toggle, streak / last score chips, empty-filter hint, warm microcopy
- **Quiz** — tactile choices with correct/wrong reveal (study), live score, sticky tags, mnemonic hints, A–D / Enter / Esc, quit confirm
- **Results** — tone by score, celebratory perfect banner, readable missed cards (decode/scenario blocks), one-tap retry missed / new set / same set
- **Persistence** — `localStorage` for filters, sessions, streak, last/best score
- **Architecture** — ES modules: data banks · `src/engine.js` · `src/storage.js` · `src/app.js`
- **Design tokens** — CSS variables for color, radius, motion, focus ring; reduced-motion respected

### Intentional follow-ons
- Spaced repetition scheduling
- Progress charts / per-topic mastery
- Oral / speak-answer mode
- Offline service worker
- Deeper per-chapter item counts where thin
