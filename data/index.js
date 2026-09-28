/**
 * Multi-pack question bank loader.
 * Packs: notes (Area I study notes), phak (FAA-H-8083-25C), afh (FAA-H-8083-3C).
 */
import { NOTES_BANK } from "./bank-notes.js";
import { PHAK_BANK } from "./bank-phak.js";
import { AFH_BANK } from "./bank-afh.js";

export const PACK_META = [
  {
    id: "notes",
    label: "Study Notes",
    short: "Notes",
    description: "ACS Area I condensed notes drills (PA.I.A–H)",
  },
  {
    id: "phak",
    label: "PHAK",
    short: "PHAK",
    description: "Pilot’s Handbook of Aeronautical Knowledge (FAA-H-8083-25C)",
  },
  {
    id: "afh",
    label: "AFH",
    short: "AFH",
    description: "Airplane Flying Handbook (FAA-H-8083-3C)",
  },
  {
    id: "all",
    label: "All packs",
    short: "All",
    description: "Notes + PHAK + AFH combined",
  },
];

const BY_ID = {
  notes: NOTES_BANK,
  phak: PHAK_BANK,
  afh: AFH_BANK,
};

/** Full combined bank (stable order: notes → phak → afh). */
export const ALL_BANKS = [...NOTES_BANK, ...PHAK_BANK, ...AFH_BANK];

export function bankForPack(packId = "all") {
  if (packId === "all" || !packId) return ALL_BANKS;
  return BY_ID[packId] || ALL_BANKS;
}

export function packStats(packId = "all") {
  const bank = bankForPack(packId);
  const byType = { mcq: 0, decode: 0, mnemonic: 0, scenario: 0 };
  const byTopic = {};
  const byChapter = {};
  bank.forEach((q) => {
    const t = q.type || "mcq";
    if (byType[t] != null) byType[t] += 1;
    byTopic[q.topic || "General"] = (byTopic[q.topic || "General"] || 0) + 1;
    if (q.chapter != null) {
      const key = `${q.handbook || q.pack} Ch${q.chapter}`;
      byChapter[key] = (byChapter[key] || 0) + 1;
    }
  });
  return {
    total: bank.length,
    byType,
    byTopic,
    byChapter,
    topics: Object.keys(byTopic).sort(),
  };
}

export { NOTES_BANK, PHAK_BANK, AFH_BANK };
