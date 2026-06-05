import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      const val = match[2].replace(/^["']|["']$/g, '').trim();
      if (val) process.env[match[1]] = val;
    }
  }
}

import { getTrendingRepos } from '../services/github.js';
import { fetchArticles } from '../services/rss.js';
import { generateSummary } from '../services/openai.js';
import { sendEmail } from '../services/email.js';
import { writeArchive } from '../lib/archive.js';

function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max).trimEnd() + '…';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function main() {
  const date = getDateString();
  console.log(`\n=== Rabbit Hole Digest — ${date} ===\n`);

  // Read config
  let config;
  try {
    const raw = readFileSync(resolve(process.cwd(), 'src/config/digests.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    config = parsed.digests.find((d) => d.id === 'rabbit-hole');
    if (!config) throw new Error('rabbit-hole digest not found in config');
    console.log('config: loaded');
  } catch (err) {
    console.warn(`config: ${err.message}`);
    return;
  }

  // Step 1: Trending repos
  console.log('\n── Trending Repos ──');
  let repos = [];
  try {
    repos = await getTrendingRepos();
    console.log(`  trending: ${repos.length} repos`);
  } catch (err) {
    console.warn(`trending repos: ${err.message}`);
  }

  // Step 2: Hacker News articles
  console.log('\n── Hacker News ──');
  let hnArticles = [];
  try {
    hnArticles = await fetchArticles(['https://hnrss.org/frontpage']);
    console.log(`  hn: ${hnArticles.length} articles`);
  } catch (err) {
    console.warn(`hn: ${err.message}`);
  }

  // Step 3: Product Hunt items
  console.log('\n── Product Hunt ──');
  let phItems = [];
  try {
    phItems = await fetchArticles(['https://www.producthunt.com/feed']);
    console.log(`  ph: ${phItems.length} items`);
  } catch (err) {
    console.warn(`ph: ${err.message}`);
  }

  // Step 4: Build user prompt
  let userPrompt = `Today's date: ${date}\n\n`;
  userPrompt += '## Trending GitHub Repos\n';
  for (const r of repos.slice(0, 10)) {
    userPrompt += `- ${r.name}: ${r.url}\n  ${r.description}\n`;
  }
  userPrompt += '\n## Hacker News Stories\n';
  for (const a of hnArticles.slice(0, 10)) {
    userPrompt += `- ${a.title} (${a.url})\n  ${truncate(a.summary, 150)}\n`;
  }
  userPrompt += '\n## Product Hunt Launches\n';
  for (const p of phItems.slice(0, 10)) {
    userPrompt += `- ${p.title} (${p.url})\n  ${truncate(p.summary, 150)}\n`;
  }

  // Step 5: AI summary
  console.log('\n── AI Summary ──');
  let summary = '';
  try {
    summary = await generateSummary({
      systemPrompt: config.systemPrompt,
      userPrompt,
    });
    console.log(`  summary: ${truncate(summary, 100)}`);
  } catch (err) {
    console.warn(`openai: ${err.message}`);
    summary = 'Summary unavailable.';
  }

  // Step 6: Build email HTML
  const repoItems = repos
    .slice(0, 8)
    .map((r) => `<li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
      <a href="${r.url}" style="color:#1a73e8;text-decoration:none;font-weight:600;font-size:15px;">${r.name}</a>
      <br><span style="color:#555;font-size:13px;">${r.description || 'No description'}</span>
      <br><span style="color:#999;font-size:11px;">★ ${r.stars?.toLocaleString() || '?'} stars</span>
    </li>`)
    .join('\n');

  const discoverItems = [];
  for (const a of hnArticles.slice(0, 6)) {
    discoverItems.push(`<li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
      <a href="${a.url}" style="color:#1a73e8;text-decoration:none;font-weight:600;font-size:15px;">${a.title}</a>
      <br><span style="background:#ffedd5;color:#9a3412;font-size:10px;font-weight:600;padding:1px 6px;border-radius:2px;text-transform:uppercase;">Hacker News</span>
    </li>`);
  }
  for (const p of phItems.slice(0, 4)) {
    discoverItems.push(`<li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
      <a href="${p.url}" style="color:#1a73e8;text-decoration:none;font-weight:600;font-size:15px;">${p.title}</a>
      <br><span style="background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:600;padding:1px 6px;border-radius:2px;text-transform:uppercase;">Product Hunt</span>
    </li>`);
  }

  const safeSummary = summary
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table style="width:100%;background:#f4f4f4;" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;">
    <table style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#7c3aed,#4c1d95);padding:28px 24px 24px;">
        <h1 style="margin:0;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:700;">🐇 ${config.name}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;">${formatDate(date)}</p>
      </td></tr>

      <!-- Trending Repos -->
      ${repoItems ? `<tr><td style="padding:24px 24px 8px;">
        <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">Trending Repos</h2>
        <ul style="padding:0;margin:0;list-style:none;">${repoItems}</ul>
      </td></tr>` : ''}

      <!-- Discoveries -->
      ${discoverItems.length ? `<tr><td style="padding:16px 24px 8px;">
        <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">Discoveries</h2>
        <ul style="padding:0;margin:0;list-style:none;">${discoverItems.join('\n')}</ul>
      </td></tr>` : ''}

      <!-- AI Summary -->
      <tr><td style="padding:16px 24px 24px;">
        <h2 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">AI Summary</h2>
        <table style="width:100%;background:#f8f9fa;border-radius:6px;border-left:3px solid #7c3aed;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#444;">${safeSummary}</td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:16px 24px;background:#f8f9fa;border-top:1px solid #eee;">
        <p style="margin:0;color:#aaa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;">Generated by AI Digests · <a href="https://github.com/ntrevino/ai-digests" style="color:#1a73e8;text-decoration:none;">View on GitHub</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

  // Step 7: Send email
  console.log('\n── Email ──');
  const subject = `Rabbit Hole Digest - ${date}`;
  try {
    const result = await sendEmail({ to: process.env.EMAIL_TO, subject, html });
    if (result.success) {
      console.log(`  email: sent — ${result.messageId}`);
    } else {
      console.warn(`  email: failed — ${result.error}`);
    }
  } catch (err) {
    console.warn(`  email: ${err.message}`);
  }

  // Step 8: Write archive
  console.log('\n── Archive ──');
  const discoveryLines = [];
  for (const r of repos.slice(0, 5)) {
    discoveryLines.push(`- **[${r.name}](${r.url})**${r.description ? ' — ' + r.description : ''}`);
  }
  for (const a of hnArticles.slice(0, 5)) {
    discoveryLines.push(`- **[${a.title}](${a.url})**${a.summary ? ' · ' + truncate(a.summary, 120) : ''}`);
  }
  for (const p of phItems.slice(0, 3)) {
    discoveryLines.push(`- **[${p.title}](${p.url})**${p.summary ? ' · ' + truncate(p.summary, 120) : ''}`);
  }

  const body = `## Discoveries\n\n${discoveryLines.join('\n')}\n\n## AI Summary\n\n${summary}\n`;

  try {
    await writeArchive('rabbit-hole', {
      title: config.name,
      date,
      type: 'rabbit-hole',
      icon: '🐇',
    }, body);
  } catch (err) {
    console.warn(`archive: ${err.message}`);
  }

  console.log('\n=== Done ===\n');
}

main();
