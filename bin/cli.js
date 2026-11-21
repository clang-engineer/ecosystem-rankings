#!/usr/bin/env node
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../src/collector.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cwd = process.cwd();
const exists = async p => access(p).then(() => true, () => false);
async function copyIfAbsent(source, dest) {
  if (await exists(dest)) { console.log(`Keeping existing ${dest}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await readFile(resolve(root, 'templates', source)));
  console.log(`Created ${dest}`);
}
const [command, ...args] = process.argv.slice(2);
const option = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 && args[i+1] ? args[i+1] : fallback; };
try {
  if (command === 'init') {
    await copyIfAbsent('ecosystems.yml', resolve(cwd, 'ecosystems.yml'));
    await copyIfAbsent('collect.yml', resolve(cwd, '.github/workflows/ecosystem-rankings.yml'));
    console.log('Edit ecosystems.yml, then run: ecosystem-rankings collect');
  } else if (command === 'collect') {
    await collect({ config: resolve(cwd, option('--config', 'ecosystems.yml')), output: resolve(cwd, option('--output', 'data/rankings.json')), history: resolve(cwd, option('--history', 'data/history.json')), token: process.env.GITHUB_TOKEN });
  } else {
    console.log('Usage: ecosystem-rankings init | collect [--config path] [--output path] [--history path]');
    if (command) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
