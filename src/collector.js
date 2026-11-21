import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const readJson = async (path, fallback) => JSON.parse(await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return JSON.stringify(fallback); throw error; }));
const daysAgo = (date, days) => new Date(new Date(date).getTime() - days * 86400000).toISOString().slice(0, 10);
function delta(history, id, days, today) {
  const cutoff = daysAgo(today, days);
  const earlier = history.filter(row => row.id === id && row.date <= cutoff).sort((a,b) => b.date.localeCompare(a.date))[0];
  return earlier ? history.find(row => row.id === id && row.date === today).stars - earlier.stars : null;
}
export async function collect({ config, output, history, token, fetchImpl = fetch, now = new Date() }) {
  const settings = await readJson(config, null);
  if (!Array.isArray(settings?.ecosystems)) throw Error('Config requires ecosystems array');
  const date = now.toISOString().slice(0,10);
  let snapshots = await readJson(history, []);
  const categories = [];
  for (const category of settings.ecosystems) {
    if (category.source !== 'github' || (category.topic && !/^[a-z0-9-]+$/i.test(category.topic))) throw Error(`Unsupported source or topic: ${category.id}`);
    const repositories = category.repositories ?? [];
    if (!Array.isArray(repositories) || repositories.some(name => !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(name))) throw Error(`Invalid repositories for ${category.id}`);
    if (!category.topic && repositories.length === 0) throw Error(`Provide topic or repositories for ${category.id}`);
    const limit = Math.min(100, Math.max(1, Number(category.limit) || 20));
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ecosystem-rankings', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const request = async url => {
      const response = await fetchImpl(url, { headers });
      if (!response.ok) throw Error(`GitHub API ${response.status}: ${(await response.text()).slice(0,180)}`);
      return response.json();
    };
    const normalize = repo => ({ id: repo.full_name, name: repo.name, description: repo.description || '', url: repo.html_url, stars: repo.stargazers_count });
    const discovered = category.topic
      ? (await request(`https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${category.topic}`)}&sort=stars&order=desc&per_page=${limit}`)).items || []
      : [];
    const merged = new Map(discovered.map(repo => [repo.full_name.toLowerCase(), normalize(repo)]));
    for (const name of repositories) {
      const key = name.toLowerCase();
      if (!merged.has(key)) {
        const repo = await request(`https://api.github.com/repos/${name.split('/').map(encodeURIComponent).join('/')}`);
        merged.set(repo.full_name.toLowerCase(), normalize(repo));
      }
    }
    const items = [...merged.values()].sort((a,b) => b.stars - a.stars || a.id.localeCompare(b.id));
    for (const item of items) snapshots = snapshots.filter(row => !(row.id === item.id && row.date === date)).concat({ id: item.id, date, stars: item.stars });
    categories.push({ id: category.id, name: category.name, source: 'github', topic: category.topic || null, metric: 'stars', items: items.map(item => ({ ...item, week: delta(snapshots,item.id,7,date), month: delta(snapshots,item.id,30,date) })) });
  }
  snapshots = snapshots.filter(row => row.date >= daysAgo(date, 35));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(history), { recursive: true });
  await writeFile(history, JSON.stringify(snapshots,null,2)+'\n');
  await writeFile(output, JSON.stringify({ updatedAt: now.toISOString(), categories },null,2)+'\n');
  console.log(`Collected ${categories.length} categories into ${output}`);
}
