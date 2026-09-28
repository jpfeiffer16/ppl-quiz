# PPL Quiz (Private Pilot practice)

Static practice app with **multiple question packs**:

| Pack | Source | Focus |
|------|--------|--------|
| **Notes** | Your condensed study notes | ACS Area I (`PA.I.A`–`PA.I.H`) |
| **PHAK** | FAA-H-8083-25C | Aeronautical knowledge, chapter-by-chapter |
| **AFH** | FAA-H-8083-3C | Airplane flying / maneuvers knowledge |
| **All** | Combined | Full bank |

Original practice items — **not** copied from commercial or FAA knowledge-test banks. Handbook packs are authored from official FAA public-domain handbook material.

## Stack

Vanilla HTML / CSS / JS with **ES modules** (no build step, no dependencies).

## How to run

```bash
cd /workspace/ppl-quiz
python3 -m http.server 8765
```

Open: **http://127.0.0.1:8765/**

> Modules require HTTP (not `file://`).


## Install on phone (PWA)

This app is an installable Progressive Web App. Open the **https** site on your phone, then:

### iPhone / iPad (Safari)
1. Open the quiz URL in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Confirm the name (**PPL Quiz**) and tap **Add**.

### Android (Chrome / Edge)
1. Open the quiz URL in Chrome.
2. Tap the menu (⋮) → **Install app** / **Add to Home screen**, **or** use the install banner if it appears.
3. Confirm. The app opens standalone like a native app.

Offline: after the first visit, the shell, styles, scripts, and question banks are cached so you can drill without a network.

> Service worker registers only on **https** or **localhost**. Plain `http://` LAN IPs will not install as a PWA.

### Self-host MIME note

If you serve with Python, map the manifest MIME so browsers accept it:

```bash
python3 -c "
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class H(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
        '.webmanifest': 'application/manifest+json',
        '.js': 'text/javascript'}
ThreadingHTTPServer(('0.0.0.0', 8765), H).serve_forever()
"
```

GitHub Pages / Netlify / Cloudflare serve `.webmanifest` correctly by default.


## Features

- **Pack picker**: Notes | PHAK | AFH | All
- Home filters: **type chips**, **topic**, **count**, **Study / Exam** mode
- Bank overview (counts by type) + last score / streak (local)
- Study mode: immediate feedback + explanation; Exam mode: reveal at results
- Progress bar, live score (study), keyboard: `A`–`D` / `1`–`4`, `Enter`, `Esc`
- Results with tone-aware copy, missed debrief, retry missed / new set / same set
- Dark calm aviation UI (design tokens in `styles.css`)
- **PWA**: installable on phone (manifest + service worker + offline cache)

## Architecture

```
ppl-quiz/
  index.html
  styles.css
  favicon.svg
  manifest.webmanifest  PWA manifest
  sw.js                 service worker (offline shell)
  icons/                192 / 512 / maskable / apple-touch
  questions.js          thin re-export (compat)
  data/
    packs.json          pack metadata
    index.js            bankForPack / PACK_META
    bank-notes.js       Area I notes pack
    bank-phak.js        PHAK pack
    bank-afh.js         AFH pack
  sources/              FAA handbook PDFs + pdftotext extracts
  scripts/              generators that emit bank-*.js
  src/
    engine.js           filter, shuffle, grade, session
    storage.js          localStorage (ppl-quiz:v2)
    app.js              UI + pack picker + SW register
  CHANGELOG.md
  README.md
```

### Extending

**Rebuild handbook banks** after editing `scripts/banks/*.py` (base chapters + `phak_expand.py` / `afh_expand.py`):

```bash
python3 scripts/build_banks.py
```

**Add questions** — append to the appropriate `data/bank-*.js` (or generator) with a unique `id`; reload.

**New pack** — add a bank module, register in `data/index.js` + `PACK_META`, rebuild UI chips automatically from `PACK_META`.

## Question types

| `type` | UI | Scoring |
|--------|----|---------|
| `mcq` | A–D choices | `correct` index 0–3 |
| `decode` | Mono `promptBlock` + A–D | same as MCQ |
| `mnemonic` | Letter rows + typed expansions | each letter matched (forgiving) against `answers[]` |
| `scenario` | Scenario blurb + A–D | same as MCQ |

## Content model

Shared fields plus pack metadata:

```js
{
  id: 10001,                 // unique across packs
  pack: "phak",              // notes | phak | afh
  handbook: "PHAK",
  chapter: 5,
  chapterTitle: "Aerodynamics of Flight",
  type: "mcq",
  topic: "PHAK Ch5 · Aerodynamics",
  acsCode: "PA.I.F",         // when mappable
  question: "…",
  choices: ["A","B","C","D"],
  correct: 0,
  explanation: "…"
}
```

## Sources (FAA)

Downloaded under `sources/` — see `sources/MANIFEST.md`.

- PHAK: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/
- AFH: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook/

## License note

FAA handbooks are U.S. government works (public domain). Practice questions in this app are original.
