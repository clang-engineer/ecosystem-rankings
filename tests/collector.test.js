import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect } from '../src/collector.js';

test('collects GitHub topic data and computes week/month only with history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ecosystem-rankings-'));
  const config = join(dir, 'ecosystems.json'), output = join(dir, 'rankings.json'), history = join(dir, 'history.json');
  await writeFile(config, JSON.stringify({ ecosystems: [{ id: 'test', name: 'Test', source: 'github', topic: 'terminal-file-manager', limit: 2 }] }));
  await writeFile(history, JSON.stringify([{id:'owner/tool',date:'2026-11-14',stars:10},{id:'owner/tool',date:'2026-10-22',stars:3}]));
  const fetchImpl = async () => ({ ok:true, json:async()=>({items:[{full_name:'owner/tool',name:'tool',description:'example',html_url:'https://github.com/owner/tool',stargazers_count:20}]}) });
  await collect({config,output,history,now:new Date('2026-11-21T00:00:00Z'),fetchImpl});
  const data=JSON.parse(await readFile(output,'utf8'));
  assert.equal(data.categories[0].items[0].periods['7'],10);
  assert.equal(data.categories[0].items[0].periods['30'],17);
});

test('merges explicit repositories, deduplicates topic results, and sorts by stars', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ecosystem-rankings-'));
  const config = join(dir, 'ecosystems.json'), output = join(dir, 'rankings.json'), history = join(dir, 'history.json');
  await writeFile(config, JSON.stringify({ ecosystems: [{ id: 'files', name: 'Files', source: 'github', topic: 'terminal-file-manager', repositories: ['owner/popular','owner/existing'] }] }));
  const requests = [];
  const makeRepo = (name, stars) => ({ full_name: name, name: name.split('/')[1], html_url: 'https://github.com/'+name, description: '', stargazers_count: stars });
  const fetchImpl = async url => {
    requests.push(url);
    const body = url.includes('/search/repositories') ? { items: [makeRepo('owner/existing', 5)] } : makeRepo('owner/popular', 100);
    return { ok: true, json: async () => body };
  };
  await collect({ config, output, history, fetchImpl, now: new Date('2026-11-21T00:00:00Z') });
  const data = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(data.categories[0].items.map(x=>x.id), ['owner/popular','owner/existing']);
  assert.equal(requests.length, 2);
});

test('reads YAML periods and emits configured default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ecosystem-rankings-'));
  const config = join(dir, 'ecosystems.yml'), output = join(dir, 'rankings.json'), history = join(dir, 'history.json');
  await writeFile(config, 'viewer:\n  default_period: 7\nperiods: [7, 30, 0]\necosystems:\n  - id: test\n    name: Test\n    source: github\n    repositories:\n      - owner/tool\n');
  const fetchImpl = async () => ({ ok:true, json:async()=>({full_name:'owner/tool',name:'tool',description:'',html_url:'https://github.com/owner/tool',stargazers_count:20}) });
  await collect({config,output,history,now:new Date('2026-11-21T00:00:00Z'),fetchImpl});
  const data = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(data.periods, [7,30,0]);
  assert.equal(data.defaultPeriod, 7);
  assert.equal(data.categories[0].items[0].periods['7'], null);
});

test('curated mode skips topic search and exclude removes configured repositories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ecosystem-rankings-'));
  const config = join(dir, 'ecosystems.json'), output = join(dir, 'rankings.json'), history = join(dir, 'history.json');
  await writeFile(config, JSON.stringify({ ecosystems: [{ id: 'test', name: 'Test', source: 'github', discovery: 'curated', topic: 'some-topic', repositories: ['owner/keep', 'owner/drop'], exclude: ['OWNER/DROP'] }] }));
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    const name = url.split('/repos/')[1];
    return { ok:true, json:async()=>({full_name:name,name:name.split('/')[1],description:'',html_url:'https://github.com/'+name,stargazers_count:10}) };
  };
  await collect({config,output,history,now:new Date('2026-11-21T00:00:00Z'),fetchImpl});
  const data = JSON.parse(await readFile(output,'utf8'));
  assert.deepEqual(data.categories[0].items.map(item=>item.id), ['owner/keep']);
  assert.equal(data.categories[0].discovery, 'curated');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(url => url.includes('/repos/')));
});
