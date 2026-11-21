import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import YAML from 'yaml';
const readJson = async (path, fallback) => { const raw = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; }); return raw.trim() ? JSON.parse(raw) : fallback; };
const daysAgo = (date, days) => new Date(new Date(date).getTime() - days * 86400000).toISOString().slice(0, 10);
function delta(history, id, days, today) {
  const cutoff = daysAgo(today, days);
  const earlier = history.filter(row => row.id === id && row.date <= cutoff).sort((a,b) => b.date.localeCompare(a.date))[0];
  return earlier ? history.find(row => row.id === id && row.date === today).stars - earlier.stars : null;
}
export async function collect({ config, output, history, token, fetchImpl = fetch, now = new Date() }) {
  const rawConfig = await readFile(config, 'utf8');
  const settings = ['.yml', '.yaml'].includes(extname(config).toLowerCase()) ? YAML.parse(rawConfig) : JSON.parse(rawConfig);
  const periods = settings.periods ?? [7, 30, 0];
  if (!Array.isArray(periods) || !periods.length || new Set(periods).size !== periods.length || periods.some(n => !Number.isInteger(n) || n < 0 || n > 3650)) throw Error('periods must be unique integers from 0 to 3650');
  const defaultPeriod = settings.viewer?.default_period ?? 0;
  if (!periods.includes(defaultPeriod)) throw Error('viewer.default_period must be included in periods');
  const positive = periods.filter(n => n > 0);
  const maxDays = Math.max(0, ...positive);
  if (!Array.isArray(settings?.ecosystems)) throw Error('Config requires ecosystems array');
  const date = now.toISOString().slice(0,10);
  let snapshots = await readJson(history, []);
  const previous = await readJson(output, { categories: [] });
  const previousByCategory = new Map((previous.categories || []).map(category => [category.id, category.items || []]));
  const categories = [];
  for (const category of settings.ecosystems) {
    if (category.source !== 'github' || (category.topic && !/^[a-z0-9-]+$/i.test(category.topic))) throw Error(`Unsupported source or topic: ${category.id}`);
    const repositories = category.repositories ?? [];
    const exclude = category.exclude ?? [];
    const mode = category.discovery ?? (category.topic || category.searches?.length ? 'topic' : 'curated');
    if (!['topic', 'curated'].includes(mode)) throw Error(`Invalid discovery for ${category.id}`);
    if (!Array.isArray(exclude) || exclude.some(name => !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(name))) throw Error(`Invalid exclude for ${category.id}`);
    if (!Array.isArray(repositories) || repositories.some(name => !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(name))) throw Error(`Invalid repositories for ${category.id}`);
    if ((mode === 'curated' && repositories.length === 0) || (mode === 'topic' && !category.topic && !(category.searches?.length) && repositories.length === 0)) throw Error(`Provide topic, searches or repositories for ${category.id}`);
    const searches = category.searches ?? [];
    if (!Array.isArray(searches) || searches.length > 5 || searches.some(q => typeof q !== 'string' || !q.trim() || q.length > 150)) throw Error(`Invalid searches for ${category.id}`);
    const limit = Math.min(100, Math.max(1, Number(category.limit) || 20));
    const searchPages = category.search_pages ?? 1;
    const searchSorts = category.search_sorts ?? ['stars'];
    if (!Number.isInteger(searchPages) || searchPages < 1 || searchPages > 10) throw Error('search_pages must be 1..10');
    if (!Array.isArray(searchSorts) || !searchSorts.length || new Set(searchSorts).size !== searchSorts.length || searchSorts.some(sort => !['stars', 'best-match'].includes(sort))) throw Error('search_sorts must contain stars and/or best-match');
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ecosystem-rankings', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const request = async url => {
      const response = await fetchImpl(url, { headers });
      if (!response.ok) throw Error(`GitHub API ${response.status}: ${(await response.text()).slice(0,180)}`);
      return response.json();
    };
    const normalize = repo => ({ id: repo.full_name, name: repo.name, description: repo.description || '', url: repo.html_url, stars: repo.stargazers_count });
    const queries = mode === 'topic' ? [...(category.topic ? [`topic:${category.topic}`] : []), ...searches] : [];
    const merged = new Map();
    const searchStats = [];
    for (const query of queries) {
      for (const sort of searchSorts) {
        let added = 0;
        for (let page = 1; page <= searchPages; page++) {
          const sorting = sort === 'stars' ? '&sort=stars&order=desc' : '';
          const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}${sorting}&per_page=${limit}&page=${page}`;
          const result = await request(url);
          const found = result.items || [];
          for (const repo of found) {
            if (repo.archived || repo.fork) continue;
            const key = repo.full_name.toLowerCase();
            if (!merged.has(key)) added++;
            merged.set(key, normalize(repo));
          }
          if (found.length < limit) break;
        }
        searchStats.push({ query, sort, added });
      }
    }
    for (const name of repositories) {
      const key = name.toLowerCase();
      if (!merged.has(key)) {
        const repo = await request(`https://api.github.com/repos/${name.split('/').map(encodeURIComponent).join('/')}`);
        merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    // Keep previously discovered repositories even when they fall out of search results.
    // Refresh live Stars instead of copying stale values from the previous output.
    if (mode === 'topic') {
      const previousItems = previousByCategory.get(category.id) || [];
      const excluded = new Set(exclude.map(name => name.toLowerCase()));
      const missing = previousItems.filter(item => item.id && !merged.has(item.id.toLowerCase()) && !excluded.has(item.id.toLowerCase()));
      for (let start = 0; start < missing.length; start += 8) {
        const batch = missing.slice(start, start + 8);
        const refreshed = await Promise.all(batch.map(async item => {
          const response = await fetchImpl('https://api.github.com/repos/' + item.id.split('/').map(encodeURIComponent).join('/'), { headers });
          if (response.status === 404 || response.status === 410) return null;
          if (!response.ok) throw Error('GitHub API ' + response.status + ' refreshing ' + item.id + ': ' + (await response.text()).slice(0, 180));
          return response.json();
        }));
        for (const repo of refreshed) if (repo && !repo.archived && !repo.fork) merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    for (const name of exclude) merged.delete(name.toLowerCase());
    const items = [...merged.values()].sort((a,b) => b.stars - a.stars || a.id.localeCompare(b.id));
    for (const item of items) snapshots = snapshots.filter(row => !(row.id === item.id && row.date === date)).concat({ id: item.id, date, stars: item.stars });
    categories.push({ id: category.id, name: category.name, source: 'github', topic: category.topic || null, searches: mode === 'topic' ? searches : [], searchSort: mode === 'topic' ? searchSorts.join(', ') : null, searchSorts: mode === 'topic' ? searchSorts : [], searchPages: mode === 'topic' ? searchPages : 0, searchStats, searchLimit: mode === 'topic' ? limit : null, discovery: mode, metric: 'stars', items: items.map(item => ({ ...item, periods: Object.fromEntries(positive.map(days => [String(days), delta(snapshots,item.id,days,date)])) })) });
  }
  snapshots = snapshots.filter(row => row.date >= daysAgo(date, maxDays + 5));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(history), { recursive: true });
  await writeFile(history, JSON.stringify(snapshots,null,2)+'\n');
  await writeFile(output, JSON.stringify({ updatedAt: now.toISOString(), periods, defaultPeriod, categories },null,2)+'\n');
  console.log(`Collected ${categories.length} categories into ${output}`);
}
