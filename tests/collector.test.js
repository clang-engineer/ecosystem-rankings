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
  assert.equal(data.categories[0].items[0].week,10);
  assert.equal(data.categories[0].items[0].month,17);
});
