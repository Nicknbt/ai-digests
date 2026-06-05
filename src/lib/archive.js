import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function formatFrontmatter(frontmatter) {
  return Object.entries(frontmatter)
    .map(([key, value]) => {
      const str = String(value);
      if (str.includes(' ') || /[^\x20-\x7E]/.test(str)) {
        return `${key}: "${str}"`;
      }
      return `${key}: ${str}`;
    })
    .join('\n');
}

export async function writeArchive(digestId, frontmatter, body) {
  const archivesDir = resolve(process.cwd(), 'archives');
  const date = frontmatter.date;
  const filename = `${date}-${digestId}.md`;
  const filepath = resolve(archivesDir, filename);

  if (existsSync(filepath)) {
    console.log(`archive: ${filename} already exists, skipping`);
    return filename;
  }

  mkdirSync(archivesDir, { recursive: true });

  const content = `---\n${formatFrontmatter(frontmatter)}\n---\n\n${body}`;
  writeFileSync(filepath, content, 'utf-8');
  console.log(`archive: wrote ${filename}`);
  return filename;
}
