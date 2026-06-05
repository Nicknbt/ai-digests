import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env
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

import { getPackageInfo } from '../services/npm.js';
import { getLatestRelease } from '../services/github.js';
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

// Spam keywords to filter out articles
const SPAM_PATTERNS = [
  /\b(buy|sell|cheap|discount|price)\b/i,
  /\b(SEO|backlink|keyword rank)\b/i,
  /\b(crypto|bitcoin|NFT|token)\b/i,
  /\b(earn money|passive income|get rich)\b/i,
  /\b(old yahoo|buy.*account|sell.*account)\b/i,
];

function isSpam(article) {
  const text = `${article.title} ${article.summary}`;
  return SPAM_PATTERNS.some((p) => p.test(text));
}

// Quality score for sources (higher = more trusted curation)
const SOURCE_QUALITY = {
  'JavaScript Weekly': 10,
  'Frontend Focus': 10,
  'React Status': 10,
  'Smashing Magazine': 8,
};

function getSourceWeight(source) {
  return SOURCE_QUALITY[source] || 1;
}

function filterArticles(articles, maxPerSource = 4, maxTotal = 15) {
  // Remove spam
  const clean = articles.filter((a) => !isSpam(a));

  // Group by source, take top N per source, preserving date order
  const bySource = {};
  for (const a of clean) {
    if (!bySource[a.source]) bySource[a.source] = [];
    bySource[a.source].push(a);
  }

  const selected = [];
  for (const [source, items] of Object.entries(bySource)) {
    const weight = getSourceWeight(source);
    const limit = Math.max(maxPerSource, Math.round(maxPerSource * (weight / 5)));
    const picked = items.slice(0, limit).map((a) => ({ ...a, _sourceWeight: weight }));
    selected.push(...picked);
  }

  // Sort by: source weight desc, then date desc
  selected.sort((a, b) => {
    if (b._sourceWeight !== a._sourceWeight) return b._sourceWeight - a._sourceWeight;
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return selected.slice(0, maxTotal);
}

async function main() {
  const date = getDateString();
  console.log(`\n=== Frontend Ecosystem Digest — ${date} ===\n`);

  // Read config
  let config;
  try {
    const raw = readFileSync(resolve(process.cwd(), 'src/config/digests.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    config = parsed.digests.find((d) => d.id === 'frontend');
    if (!config) throw new Error('frontend digest not found in config');
    console.log('config: loaded');
  } catch (err) {
    console.warn(`config: ${err.message}`);
    return;
  }

  // Step 1: Framework versions + dist-tags
  console.log('\n── Framework Versions ──');
  const frameworks = [];
  for (const fw of config.frameworks) {
    const info = await getPackageInfo(fw.npm);
    const displayVersion = info.isStable ? info.latestVersion : `${info.latestVersion} (stable: ${info.stableVersion || '—'})`;
    frameworks.push({
      name: fw.name,
      version: info.latestVersion,
      stableVersion: info.stableVersion,
      isStable: info.isStable,
      displayVersion,
      owner: fw.owner,
      repo: fw.repo,
    });
    const flag = info.isStable ? '✓' : '⚠';
    console.log(`  npm: ${fw.name} → ${info.latestVersion} ${flag}`);
  }

  // Step 2: GitHub releases
  console.log('\n── GitHub Releases ──');
  const releases = [];
  for (const fw of frameworks) {
    try {
      const rel = await getLatestRelease(fw.owner, fw.repo);
      if (rel) {
        releases.push({
          name: fw.name,
          tag: rel.tag_name,
          url: rel.html_url,
          date: rel.published_at,
          body: truncate(rel.body, 200),
        });
        console.log(`  release: ${fw.name} → ${rel.tag_name} (${formatDate(rel.published_at)})`);
      } else {
        console.log(`  release: ${fw.name} → none`);
      }
    } catch (err) {
      console.warn(`  release: ${fw.name} failed — ${err.message}`);
    }
  }

  // Step 3: RSS articles
  console.log('\n── RSS Articles ──');
  let articles = [];
  try {
    articles = await fetchArticles(config.rssFeeds);
    console.log(`  rss: ${articles.length} raw articles`);
  } catch (err) {
    console.warn(`rss: ${err.message}`);
  }

  // Filter and limit articles
  const filteredArticles = filterArticles(articles, 4, 15);
  const removedCount = articles.length - filteredArticles.length;
  if (removedCount > 0) console.log(`  filtered: removed ${removedCount} (spam/limit)`);
  console.log(`  articles: ${filteredArticles.length} curated items`);

  // Step 4: Build user prompt
  let userPrompt = `Today's date: ${date}\n\n`;
  userPrompt += '## Framework Versions\n';
  for (const fw of frameworks) {
    userPrompt += `- ${fw.name}: ${fw.version}${fw.isStable ? '' : ` (pre-release, stable: ${fw.stableVersion || 'none'})`}\n`;
  }
  userPrompt += '\n## GitHub Releases\n';
  for (const r of releases) {
    userPrompt += `- ${r.name}: ${r.tag} — ${r.date ? formatDate(r.date) : 'no date'} — ${r.url}\n  ${r.body}\n`;
  }
  userPrompt += '\n## Articles\n';
  for (const a of filteredArticles) {
    userPrompt += `- [${a.title}](${a.url}) — ${a.source}\n  ${truncate(a.summary, 150)}\n`;
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
  const verRows = frameworks
    .map((fw) => {
      const badge = fw.isStable
        ? `<span style="background:#e6f4ea;color:#1e7e34;font-size:11px;font-weight:600;padding:2px 7px;border-radius:3px;white-space:nowrap;">stable</span>`
        : `<span style="background:#fef7e0;color:#b06000;font-size:11px;font-weight:600;padding:2px 7px;border-radius:3px;white-space:nowrap;">pre-release</span>`;
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;">${fw.name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:13px;">${fw.version} ${badge}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">${fw.stableVersion && !fw.isStable ? fw.stableVersion : '—'}</td>
      </tr>`;
    })
    .join('\n');

  const releaseItems = releases
    .filter((r) => r.date)
    .slice(0, 6)
    .map((r) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;"><a href="${r.url}" style="color:#1a73e8;text-decoration:none;">${r.name}</a></td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:13px;">${r.tag}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">${formatDate(r.date)}</td>
    </tr>`)
    .join('\n');

  const articleItems = filteredArticles
    .map((a) => {
      const sourceBadge = getSourceWeight(a.source) >= 8
        ? `<span style="background:#e8f0fe;color:#1a56db;font-size:10px;font-weight:600;padding:1px 6px;border-radius:2px;text-transform:uppercase;">${a.source}</span>`
        : `<span style="color:#888;font-size:11px;">${a.source}</span>`;
      return `<li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
        <a href="${a.url}" style="color:#1a73e8;text-decoration:none;font-weight:600;font-size:15px;line-height:1.4;">${a.title}</a>
        <br><span style="color:#888;font-size:12px;">${sourceBadge}${a.date ? ' · ' + formatDate(a.date) : ''}</span>
      </li>`;
    })
    .join('\n');

  // Escape summary for HTML (basic)
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
      <tr><td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:28px 24px 24px;">
        <h1 style="margin:0;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:700;">🖥️ ${config.name}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;">${formatDate(date)}</p>
      </td></tr>

      <!-- Framework Versions -->
      <tr><td style="padding:24px 24px 8px;">
        <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">Framework Versions</h2>
        <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Framework</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Latest</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Stable</th>
          </tr></thead>
          <tbody>${verRows}</tbody>
        </table>
      </td></tr>

      <!-- Release Highlights -->
      ${releaseItems ? `<tr><td style="padding:16px 24px 8px;">
        <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">Release Highlights</h2>
        <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Project</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Version</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;text-transform:uppercase;color:#666;">Date</th>
          </tr></thead>
          <tbody>${releaseItems}</tbody>
        </table>
      </td></tr>` : ''}

      <!-- Articles -->
      ${articleItems ? `<tr><td style="padding:16px 24px 8px;">
        <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">Top Articles</h2>
        <ul style="padding:0;margin:0;list-style:none;">${articleItems}</ul>
      </td></tr>` : ''}

      <!-- AI Summary -->
      <tr><td style="padding:16px 24px 24px;">
        <h2 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;color:#333;">AI Summary</h2>
        <table style="width:100%;background:#f8f9fa;border-radius:6px;border-left:3px solid #1a73e8;" cellpadding="0" cellspacing="0">
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
  const subject = `Frontend Ecosystem Digest - ${date}`;
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
  const verLines = frameworks.map((fw) => {
    const ver = fw.isStable ? fw.version : `${fw.version} (${fw.stableVersion || 'pre-release'})`;
    return `| ${fw.name.padEnd(9)} | ${ver.padEnd(8)} |`;
  }).join('\n');
  const topArticles = filteredArticles.slice(0, 10).map((a) =>
    `- **[${a.title}](${a.url})** — ${a.source}${a.summary ? ' · ' + truncate(a.summary, 120) : ''}`
  ).join('\n');
  const body = `## Framework Versions\n\n| Framework | Version |\n|-----------|---------|\n${verLines}\n\n## Top Articles\n\n${topArticles}\n\n## AI Summary\n\n${summary}\n`;

  try {
    await writeArchive('frontend', {
      title: config.name,
      date,
      type: 'frontend',
      icon: '🖥️',
    }, body);
  } catch (err) {
    console.warn(`archive: ${err.message}`);
  }

  console.log('\n=== Done ===\n');
}

main();
