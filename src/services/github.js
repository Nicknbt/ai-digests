function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getLatestRelease(owner, repo) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json', ...authHeaders() } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`github: ${res.status} for ${owner}/${repo}`);
      return null;
    }
    const data = await res.json();
    return {
      tag_name: data.tag_name,
      html_url: data.html_url,
      published_at: data.published_at,
      body: data.body || '',
    };
  } catch (err) {
    console.warn(`github: failed to fetch release for ${owner}/${repo} — ${err.message}`);
    return null;
  }
}

export async function getTrendingRepos(language, since = 'daily') {
  try {
    const langPath = language ? `/${encodeURIComponent(language)}` : '';
    const url = `https://github.com/trending${langPath}?since=${since}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...authHeaders() } });
    if (!res.ok) {
      console.warn(`github: trending scrape returned ${res.status}, falling back to search API`);
      return fallbackTrending(language);
    }
    const html = await res.text();
    const repos = [];
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
    let match;
    while ((match = articleRegex.exec(html)) !== null) {
      const article = match[1];
      const nameMatch = article.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+?)"[^>]*>/);
      const descMatch = article.match(/<p[^>]*class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const starMatch = article.match(/<span[^>]*id="repo-stars-counter-star"[^>]*>([^<]+)<\/span>/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      repos.push({
        name,
        url: `https://github.com/${name}`,
        description: descMatch ? descMatch[1].trim() : '',
        stars: starMatch ? parseInt(starMatch[1].replace(/,/g, ''), 10) || 0 : 0,
      });
    }
    return repos.length > 0 ? repos : fallbackTrending(language);
  } catch (err) {
    console.warn(`github: trending failed — ${err.message}, falling back to search API`);
    return fallbackTrending(language);
  }
}

async function fallbackTrending(language) {
  try {
    const daysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let query = `created:>${daysAgo}`;
    if (language) query += `+language:${encodeURIComponent(language)}`;
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json', ...authHeaders() },
    });
    if (!res.ok) {
      console.warn(`github: search API returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item) => ({
      name: item.full_name,
      url: item.html_url,
      description: item.description || '',
      stars: item.stargazers_count,
    }));
  } catch (err) {
    console.warn(`github: fallback trending failed — ${err.message}`);
    return [];
  }
}
