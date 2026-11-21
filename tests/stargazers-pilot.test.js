import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRecentStars } from '../src/stargazers-pilot.js';

test('counts recent retained stars from final page', async () => {
  const now = new Date('2026-11-21T00:00:00Z');
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    const entries = page === 1 ? [{starred_at:'2026-10-01T00:00:00Z'}] : [
      {starred_at:'2026-11-10T00:00:00Z'},
      {starred_at:'2026-11-18T00:00:00Z'},
      {starred_at:'2026-11-20T00:00:00Z'}
    ];
    return {ok:true,headers:{get:()=>page===1?'<https://api.github.com/repos/a/b/stargazers?per_page=100&page=2>; rel="last"':''},json:async()=>entries};
  };
  const result=await estimateRecentStars({repository:'a/b',days:7,now,fetchImpl});
  assert.equal(result.retainedStarsAdded,2);
  assert.equal(result.complete,true);
  assert.equal(calls.length,2);
});

test('reports incomplete instead of inventing a growth count when page budget is exhausted', async () => {
  const fetchImpl = async url => ({
    ok:true,
    headers:{get:()=>'<https://api.github.com/repos/a/b/stargazers?per_page=100&page=9>; rel="last"'},
    json:async()=>[{starred_at:'2026-11-20T00:00:00Z'}]
  });
  const result=await estimateRecentStars({repository:'a/b',now:new Date('2026-11-21T00:00:00Z'),maxPages:2,fetchImpl});
  assert.equal(result.complete,false);
  assert.equal(result.retainedStarsAdded,null);
});
