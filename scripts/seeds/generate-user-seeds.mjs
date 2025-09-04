#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = resolve(__dirname, 'huntspeak_data.json');
const outPath = resolve(__dirname, '../../src/data/userSeeds.ts');

const raw = JSON.parse(readFileSync(srcPath, 'utf8'));

const normStr = (v) => (v ?? '').toString().trim();
const rootsIn = Array.isArray(raw.roots) ? raw.roots : [];
const nounsIn = Array.isArray(raw.nouns) ? raw.nouns : [];

// Filter + normalize
const roots = rootsIn
  .map(r => ({ c1: normStr(r.c1), c2: normStr(r.c2), c3: normStr(r.c3), gloss: normStr(r.gloss), synonyms: Array.isArray(r.synonyms) ? r.synonyms.map(normStr).filter(Boolean) : [] }))
  .filter(r => r.c1 && r.c2 && r.c3);

const nouns = nounsIn
  .map(n => ({ word: normStr(n.word), gloss: normStr(n.gloss), synonyms: Array.isArray(n.synonyms) ? n.synonyms.map(normStr).filter(Boolean) : [] }))
  .filter(n => n.word);

// Deduplicate
const rootSig = (r) => `${r.c1.toLowerCase()}-${r.c2.toLowerCase()}-${r.c3.toLowerCase()}`;
const seenRoot = new Set();
const dedupRoots = roots.filter(r => { const k = rootSig(r); if (seenRoot.has(k)) return false; seenRoot.add(k); return true; });

const seenNoun = new Set();
const dedupNouns = nouns.filter(n => { const k = n.word.toLowerCase(); if (seenNoun.has(k)) return false; seenNoun.add(k); return true; });

const header = `// Generated from scripts/seeds/huntspeak_data.json\n// Do not edit manually — run: node scripts/seeds/generate-user-seeds.mjs\n`;
const toTsArr = (arr, keys) => `[
${arr.map(o => `  { ${keys.map(k => `${k}: ${JSON.stringify(o[k])}`).join(', ')} },`).join('\n')}
]`;

const ts = `${header}
export const SEED_ROOTS = ${toTsArr(dedupRoots, ['c1','c2','c3','gloss','synonyms'])} as const;\n
export const SEED_NOUNS = ${toTsArr(dedupNouns, ['word','gloss','synonyms'])} as const;\n`;

writeFileSync(outPath, ts, 'utf8');
console.log(`Wrote ${outPath} (roots=${dedupRoots.length}, nouns=${dedupNouns.length})`);

