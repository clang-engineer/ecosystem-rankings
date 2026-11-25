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
  const repoCache = new Map();
  const readmeCache = new Map();
  const MAX_README_CHECKS = 12;
  const MAX_PREVIOUS_REFRESHES = 24;
  let previousRefreshes = 0;
  let lastSearchAt = 0;
  const throttleSearch = async () => {
    if (fetchImpl !== fetch) return; // unit tests use a mock transport
    const wait = Math.max(0, 2200 - (Date.now() - lastSearchAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastSearchAt = Date.now();
  };
  const fetchWithRateLimitRetry = async (url, options) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(url, options);
      if (attempt === 2 || ![403, 429].includes(response.status)) return response;

      const headers = response.headers;
      const exhausted = headers?.get('x-ratelimit-remaining') === '0';
      const retryAfter = headers?.get('retry-after');
      const body = await response.clone().text();
      if (response.status !== 429 && !exhausted && retryAfter == null && !/rate limit exceeded/i.test(body)) return response;

      const reset = Number(headers?.get('x-ratelimit-reset'));
      const delay = retryAfter != null && /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : exhausted && reset > 0
          ? Math.max(0, reset * 1000 - Date.now())
          : 60000 * (attempt + 1);
      if (delay > 120000) return response;
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, delay + 1000));
    }
  };
  const fetchRepo = async (id, headers) => {
    const key = id.toLowerCase();
    if (!repoCache.has(key)) repoCache.set(key, (async () => {
      const response = await fetchWithRateLimitRetry('https://api.github.com/repos/' + id.split('/').map(encodeURIComponent).join('/'), { headers });
      if (response.status === 404 || response.status === 410) return null;
      if (!response.ok) throw Error('GitHub API ' + response.status + ' refreshing ' + id + ': ' + (await response.text()).slice(0,180));
      return response.json();
    })());
    return repoCache.get(key);
  };
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
    const minStars = category.min_stars ?? 0;
    if (!Number.isInteger(minStars) || minStars < 0) throw Error(`Invalid min_stars for ${category.id}`);
    const readmeSearches = category.readme_searches ?? [];
    if (!Array.isArray(readmeSearches) || readmeSearches.length > 3 || readmeSearches.some(q => typeof q !== 'string' || !q.trim() || q.length > 150 || /\bin:/.test(q))) throw Error('Invalid readme_searches');
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ecosystem-rankings', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const request = async url => {
      const response = await fetchWithRateLimitRetry(url, { headers });
      if (!response.ok) throw Error(`GitHub API ${response.status}: ${(await response.text()).slice(0,180)}`);
      return response.json();
    };
    const normalize = repo => ({ id: repo.full_name, name: repo.name, description: repo.description || '', url: repo.html_url, stars: repo.stargazers_count, forks: repo.forks_count ?? null, createdAt: repo.created_at ?? null, pushedAt: repo.pushed_at ?? null, updatedAt: repo.updated_at ?? null, language: repo.language ?? null, license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : null, topics: repo.topics ?? [], homepage: repo.homepage || null });
    const queries = mode === 'topic' ? [...(category.topic ? [`topic:${category.topic}`] : []), ...searches] : [];
    const merged = new Map();
    const previousItems = previousByCategory.get(category.id) || [];
    let readmeChecks = 0;
    const staleIds = new Set();
    for (const query of queries) {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query + (minStars ? ` stars:>=${minStars}` : ''))}&sort=stars&order=desc&per_page=${limit}`;
      await throttleSearch();
      const result = await request(url);
      for (const repo of result.items || []) {
        if (!repo.archived && !repo.fork) merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    // README results are only candidates: verify that the repository introduces itself
    // as the requested type near the beginning of its README.
    const readmeStats = { candidates: 0, accepted: 0 };
    for (const phrase of mode === 'topic' ? readmeSearches : []) {
      await throttleSearch();
      const result = await request(`https://api.github.com/search/repositories?q=${encodeURIComponent(phrase + ' in:readme' + (minStars ? ` stars:>=${minStars}` : ''))}&sort=stars&order=desc&per_page=${limit}`);
      for (const repo of result.items || []) {
        if (repo.archived || repo.fork || merged.has(repo.full_name.toLowerCase())) continue;
        readmeStats.candidates++;
        if (readmeChecks >= MAX_README_CHECKS) break;
        readmeChecks++;
        const key = repo.full_name.toLowerCase();
        if (!readmeCache.has(key)) readmeCache.set(key, (async () => {
          const response = await fetchWithRateLimitRetry('https://api.github.com/repos/' + repo.full_name.split('/').map(encodeURIComponent).join('/') + '/readme', { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } });
          if (response.status === 404) return '';
          if (!response.ok) throw Error('GitHub README API ' + response.status + ': ' + (await response.text()).slice(0,180));
          return (await response.text()).slice(0, 1800).toLowerCase();
        })());
        const intro = await readmeCache.get(key);
        const expected = phrase.toLowerCase().trim();
        // A mention in a long list of alternatives is not enough. Restrict
        // admission to a self-description near the start of the README.
        const introLines = intro.split('\n').filter(line => line.trim() && !/^\s*(!?\[|<|#|\*\*?\s*https?:)/.test(line)).slice(0, 12).join(' ');
        if (!introLines.includes(expected)) continue;
        // Do not reject candidates based on generic words such as plugin or theme.
        // These terms can be legitimate in other ecosystem categories.
        merged.set(repo.full_name.toLowerCase(), normalize(repo));
        readmeStats.accepted++;
      }
    }
    for (const name of repositories) {
      const key = name.toLowerCase();
      if (!merged.has(key)) {
        const repo = await fetchRepo(name, headers);
        if (repo && !repo.archived && !repo.fork) merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    // Keep previously discovered repositories even when they fall out of search results.
    // Refresh live Stars instead of copying stale values from the previous output.
    if (mode === 'topic') {
      const excluded = new Set(exclude.map(name => name.toLowerCase()));
      const missing = previousItems.filter(item => item.id && !merged.has(item.id.toLowerCase()) && !excluded.has(item.id.toLowerCase()));
      for (const item of missing) {
        // Retain known repositories without issuing hundreds of individual API calls.
        // Their Stars remain at the last observed value until refreshed by search or a later run.
        if (previousRefreshes >= MAX_PREVIOUS_REFRESHES) {
          merged.set(item.id.toLowerCase(), { ...item });
          staleIds.add(item.id.toLowerCase());
          continue;
        }
        previousRefreshes++;
        const repo = await fetchRepo(item.id, headers);
        if (repo && !repo.archived && !repo.fork) merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    for (const name of exclude) merged.delete(name.toLowerCase());
    const items = [...merged.values()].filter(item => Number.isFinite(item.stars) && item.stars >= minStars).sort((a,b) => b.stars - a.stars || a.id.localeCompare(b.id));
    for (const item of items) if (!staleIds.has(item.id.toLowerCase())) snapshots = snapshots.filter(row => !(row.id === item.id && row.date === date)).concat({ id: item.id, date, stars: item.stars });
    categories.push({ id: category.id, name: category.name, source: 'github', topic: category.topic || null, searches: mode === 'topic' ? searches : [], readmeSearches: mode === 'topic' ? readmeSearches : [], readmeStats, searchSort: mode === 'topic' ? 'stars' : null, searchLimit: mode === 'topic' ? limit : null, minStars, discovery: mode, metric: 'stars', items: items.map(item => ({ ...item, description: Array.from(String(item.description || '').trim()).slice(0, 500).join(''), periods: Object.fromEntries(positive.map(days => [String(days), staleIds.has(item.id.toLowerCase()) ? null : delta(snapshots,item.id,days,date)])) })) });
  }
  // Owner metadata is shared across categories and refreshed weekly.
  const owners = {};
  const ownerNames = new Map();
  for (const category of categories) for (const item of category.items) {
    const login = item.id.split('/')[0];
    ownerNames.set(login.toLowerCase(), login);
  }
  const ownerHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'ecosystem-rankings', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let ownerRequests = 0;
  for (const [key, login] of ownerNames) {
    const cached = previous.owners?.[key];
    if (cached) owners[key] = cached;
    if (cached?.fetchedAt && cached.fetchedAt >= daysAgo(date, 7)) continue;
    // Bound extra API traffic; uncached owners are picked up on subsequent runs.
    if (ownerRequests >= 100) continue;
    ownerRequests++;
    try {
      const response = await fetchWithRateLimitRetry('https://api.github.com/users/' + encodeURIComponent(login), { headers: ownerHeaders });
      if (!response.ok) continue;
      const profile = await response.json();
      if (!profile.login) continue;
      owners[key] = { login: profile.login, name: profile.name ?? null, type: profile.type ?? null, followers: profile.followers ?? null, publicRepos: profile.public_repos ?? null, createdAt: profile.created_at ?? null, fetchedAt: now.toISOString() };
    } catch (error) {
      console.warn('Owner metadata unavailable for ' + login + ': ' + error.message);
    }
  }
  snapshots = snapshots.filter(row => row.date >= daysAgo(date, maxDays + 5));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(history), { recursive: true });
  await writeFile(history, JSON.stringify(snapshots,null,2)+'\n');
  await writeFile(output, JSON.stringify({ updatedAt: now.toISOString(), periods, defaultPeriod, categories, owners },null,2)+'\n');
  console.log(`Collected ${categories.length} categories into ${output}`);
}
