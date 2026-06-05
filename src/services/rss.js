import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchArticles(feedUrls) {
  const all = [];

  for (const url of feedUrls) {
    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).map((item) => ({
        title: item.title || 'Untitled',
        url: item.link || item.guid || '',
        summary: item.contentSnippet || item.content || '',
        date: item.isoDate || item.pubDate || '',
        source: feed.title || url,
      }));
      all.push(...items);
    } catch (err) {
      console.warn(`rss: failed to fetch ${url} — ${err.message}`);
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const article of all) {
    const key = article.url || article.title;
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(article);
    }
  }

  deduped.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return deduped.slice(0, 50);
}
