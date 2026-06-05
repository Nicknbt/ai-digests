import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env manually (no dotenv dependency needed)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      const val = match[2].replace(/^["']|["']$/g, '').trim();
      if (val) process.env[match[1]] = val;
    }
  }
}

import { getLatestVersion } from '../src/services/npm.js';
import { getLatestRelease, getTrendingRepos } from '../src/services/github.js';
import { fetchArticles } from '../src/services/rss.js';
import { generateSummary } from '../src/services/openai.js';
import { sendEmail } from '../src/services/email.js';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const SKIP = '\x1b[33m−\x1b[0m';

let passed = 0;
let failed = 0;
let skipped = 0;

function log(symbol, label, detail = '') {
  console.log(`${symbol} ${label}${detail ? ` → ${detail}` : ''}`);
}

function nonEmpty(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return Boolean(val);
}

async function main() {
  console.log('\n=== AI Digests — Service Smoke Test ===\n');

  // --- npm ---
  console.log('── npm registry ──');
  try {
    const v = await getLatestVersion('react');
    nonEmpty(v.version) ? (log(PASS, `npm: react → ${v.version}`), passed++) : (log(FAIL, 'npm: react', 'no version'), failed++);
  } catch (e) { log(FAIL, 'npm: react', e.message); failed++; }

  try {
    const v = await getLatestVersion('astro');
    nonEmpty(v.version) ? (log(PASS, `npm: astro → ${v.version}`), passed++) : (log(FAIL, 'npm: astro', 'no version'), failed++);
  } catch (e) { log(FAIL, 'npm: astro', e.message); failed++; }

  try {
    const v = await getLatestVersion('@angular/core');
    nonEmpty(v.version) ? (log(PASS, `npm: @angular/core → ${v.version}`), passed++) : (log(FAIL, 'npm: @angular/core', 'no version'), failed++);
  } catch (e) { log(FAIL, 'npm: @angular/core', e.message); failed++; }

  // --- GitHub ---
  console.log('\n── GitHub API ──');
  try {
    const r = await getLatestRelease('facebook', 'react');
    nonEmpty(r) ? (log(PASS, `github: facebook/react → ${r.tag_name} (${r.published_at.slice(0, 10)})`), passed++) : (log(FAIL, 'github: facebook/react', 'no release'), failed++);
  } catch (e) { log(FAIL, 'github: facebook/react', e.message); failed++; }

  try {
    const repos = await getTrendingRepos();
    nonEmpty(repos) ? (log(PASS, `github: trending → ${repos.length} repos`), passed++) : (log(FAIL, 'github: trending', 'no repos'), failed++);
  } catch (e) { log(FAIL, 'github: trending', e.message); failed++; }

  // --- RSS ---
  console.log('\n── RSS Feeds ──');
  try {
    const articles = await fetchArticles(['https://javascriptweekly.com/rss/']);
    nonEmpty(articles) ? (log(PASS, `rss: javascriptweekly → ${articles.length} articles`), passed++) : (log(FAIL, 'rss: javascriptweekly', 'no articles'), failed++);
  } catch (e) { log(FAIL, 'rss: javascriptweekly', e.message); failed++; }

  // --- OpenAI ---
  console.log('\n── OpenAI ──');
  if (process.env.OPENAI_API_KEY) {
    try {
      const summary = await generateSummary({
        systemPrompt: 'You are a helpful assistant. Respond in one sentence.',
        userPrompt: 'Summarize: React 19.1 was released this week with new concurrent features.',
      });
      nonEmpty(summary) ? (log(PASS, `openai: summary → ${summary.slice(0, 80)}...`), passed++) : (log(FAIL, 'openai: summary', 'empty response'), failed++);
    } catch (e) { log(FAIL, 'openai: summary', e.message); failed++; }
  } else {
    log(SKIP, 'openai: summary — OPENAI_API_KEY not set');
    skipped++;
  }

  // --- Email ---
  console.log('\n── Email ──');
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.EMAIL_TO) {
    try {
      const result = await sendEmail({
        to: process.env.EMAIL_TO,
        subject: 'AI Digests — Service Test',
        html: '<h1>AI Digests</h1><p>Email service is working.</p>',
      });
      result.success ? (log(PASS, `email: sent → ${result.messageId}`), passed++) : (log(FAIL, 'email: send', result.error), failed++);
    } catch (e) { log(FAIL, 'email: send', e.message); failed++; }
  } else {
    log(SKIP, 'email: send — GMAIL_* or EMAIL_TO not set');
    skipped++;
  }

  // --- Summary ---
  console.log('\n──────────────────────────────');
  console.log(`Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log(`Result: ${failed > 0 ? 'SOME FAILURES' : 'ALL GOOD'}`);
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main();
