import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { data: object, body: string }.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content };
  }

  const raw = match[1];
  const body = match[2].trim();

  // Simple YAML parser for flat key-value frontmatter
  const data = {};
  for (const line of raw.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let value = kv[2].trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[kv[1]] = value;
    }
  }

  return { data, body };
}

/**
 * Read all archive markdown files from the archives directory,
 * parse frontmatter, and return them sorted by date descending.
 */
export function getAllArchives() {
  const archivesDir = path.resolve(new URL('../..', import.meta.url).pathname, '../archives');

  if (!fs.existsSync(archivesDir)) {
    return [];
  }

  const files = fs.readdirSync(archivesDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'));

  const archives = files.map(filename => {
    const filePath = path.join(archivesDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);
    const slug = filename.replace(/\.md$/, '');

    return {
      slug,
      frontmatter: data,
      body,
    };
  });

  // Sort by date descending
  archives.sort((a, b) => {
    const dateA = a.frontmatter.date || '';
    const dateB = b.frontmatter.date || '';
    return dateB.localeCompare(dateA);
  });

  return archives;
}

/**
 * Get a single archive by slug (filename without .md).
 */
export function getArchiveBySlug(slug) {
  const all = getAllArchives();
  return all.find(a => a.slug === slug) || null;
}
