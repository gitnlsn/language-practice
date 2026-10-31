// Checks the sentence bank (assets/sentences/<lang>/<level>.json): every topic present, every entry complete,
// no duplicates within a language. Run: npm run check:sentences
import { readFileSync } from "node:fs";
import { LEVELS, TARGETS, TOPICS } from "../../../packages/core/src/settings.ts";

const MIN_PER_TOPIC = 20;
const ends = /[.?!…]["”»)]?$/;
const problems: string[] = [];
let total = 0;

for (const lang of TARGETS) {
  const seen = new Map<string, string>();
  for (const level of LEVELS) {
    const file = `assets/sentences/${lang}/${level}.json`;
    let bank: Record<string, { text?: string; en?: string; pt?: string }[]>;
    try {
      bank = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    for (const key of Object.keys(bank)) if (!TOPICS.includes(key)) problems.push(`${file}: unknown topic "${key}"`);
    for (const topic of TOPICS) {
      const items = bank[topic] ?? [];
      if (items.length < MIN_PER_TOPIC) problems.push(`${file}: "${topic}" has ${items.length} sentences`);
      for (const [i, e] of items.entries()) {
        const where = `${file} "${topic}" #${i + 1}`;
        if (!e.text?.trim() || !e.en?.trim() || !e.pt?.trim()) problems.push(`${where}: missing text, en or pt`);
        else if (!ends.test(e.text.trim())) problems.push(`${where}: no final punctuation: ${e.text}`);
        const key = e.text?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? "";
        if (seen.has(key)) problems.push(`${where}: duplicate of ${seen.get(key)}: ${e.text}`);
        else seen.set(key, where);
      }
      total += items.length;
    }
  }
}

console.log(problems.length ? problems.join("\n") : `✓ ${total} sentences`);
process.exit(problems.length ? 1 : 0);
