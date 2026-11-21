// Optional, bounded pilot. This does not modify production ranking history.
export async function estimateRecentStars({ repository, days = 7, token, fetchImpl = fetch, now = new Date(), maxPages = 3 }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw Error('Invalid repository');
  if (!Number.isInteger(days) || days < 1 || days > 90) throw Error('Invalid period');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) throw Error('Invalid page budget');
  const headers = { Accept: 'application/vnd.github.star+json', 'User-Agent': 'ecosystem-rankings', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const base = 'https://api.github.com/repos/' + repository.split('/').map(encodeURIComponent).join('/') + '/stargazers?per_page=100&page=';
  const request = async page => {
    const response = await fetchImpl(base + page, { headers });
    if (!response.ok) throw Error('GitHub API ' + response.status + ': ' + (await response.text()).slice(0, 180));
    const entries = await response.json();
    if (!Array.isArray(entries) || entries.some(x => !x.starred_at)) throw Error('GitHub did not return dated stargazers');
    return { entries, link: response.headers?.get?.('link') || '' };
  };
  const first = await request(1);
  const lastMatch = first.link.match(/<[^>]*[?&]page=(\d+)>;\s*rel="last"/);
  const lastPage = lastMatch ? Number(lastMatch[1]) : 1;
  const cutoff = now.getTime() - days * 86400000;
  let count = 0, pagesFetched = 0, complete = false;
  for (let page = lastPage; page >= 1 && pagesFetched < maxPages; page--) {
    const entries = page === 1 ? first.entries : (await request(page)).entries;
    pagesFetched++;
    count += entries.filter(x => new Date(x.starred_at).getTime() > cutoff && new Date(x.starred_at).getTime() <= now.getTime()).length;
    if (page === 1 || (entries.length && new Date(entries[0].starred_at).getTime() <= cutoff)) { complete = true; break; }
  }
  return { repository, days, retainedStarsAdded: complete ? count : null, complete, pagesFetched, note: 'Counts currently retained stars added in the period; not net Stars growth.' };
}
