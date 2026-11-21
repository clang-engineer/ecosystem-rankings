const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => Number(value).toLocaleString();
class EcosystemRankings extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<p role="status">랭킹 데이터를 불러오는 중…</p>';
    this.load();
  }
  async load() {
    const src = this.getAttribute('src');
    if (!src) { this.textContent = 'Missing src attribute'; return; }
    try {
      const response = await fetch(src);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      this.data = await response.json();
      if (!Array.isArray(this.data.categories)) throw Error('Invalid rankings data');
      this.category = this.data.categories[0]?.id;
      this.period = String(this.data.periods?.includes(this.data.defaultPeriod) ? this.data.defaultPeriod : 0);
      this.render();
    } catch (error) {
      this.innerHTML = '<p role="alert">랭킹 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
      console.error('ecosystem-rankings:', error);
    }
  }
  render() {
    const categories = this.data.categories;
    const category = categories.find(c => c.id === this.category) || categories[0];
    const value = item => this.period === '0' ? item.stars : item.periods?.[this.period];
    const items = [...(category?.items || [])]
      .filter(item => this.period === '0' || Number.isFinite(value(item)))
      .sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id));
    const list = !category
      ? '<p>등록된 분야가 없습니다.</p>'
      : !items.length
        ? `<p role="status">${this.period === '0' ? '등록된 프로젝트가 없습니다.' : '이 기간의 기록을 수집하고 있습니다. 데이터가 쌓이면 순위가 표시됩니다.'}</p>`
        : `<ol class="er-list">${items.map((item, i) => `<li class="er-item"><span class="er-rank">${i + 1}</span><div class="er-info"><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.id)}</a><div class="er-desc">${escape(item.description)}</div></div><span class="er-score">${number(value(item))}<small>${this.period === '0' ? 'Stars' : '+ Stars'}</small></span></li>`).join('')}</ol>`;
    this.innerHTML = `<style>
      ecosystem-rankings { display:block; color:var(--text-color,inherit); }
      ecosystem-rankings .er-controls { display:flex; gap:.8rem; flex-wrap:wrap; margin:1rem 0; }
      ecosystem-rankings label { display:flex; align-items:center; gap:.45rem; font-size:.9rem; }
      ecosystem-rankings select { max-width:100%; padding:.4rem .65rem; border:1px solid var(--main-border-color,#ccc); border-radius:.45rem; background:var(--card-bg,#fff); color:inherit; }
      ecosystem-rankings .er-list { padding:0; margin:0; list-style:none; border-top:1px solid var(--main-border-color,#ddd); }
      ecosystem-rankings .er-item { display:flex; gap:.8rem; align-items:center; padding:.85rem .25rem; border-bottom:1px solid var(--main-border-color,#ddd); }
      ecosystem-rankings .er-rank { flex:0 0 2rem; font-variant-numeric:tabular-nums; text-align:center; color:var(--text-muted-color,#777); font-weight:700; }
      ecosystem-rankings .er-info { flex:1; min-width:0; overflow-wrap:anywhere; }
      ecosystem-rankings .er-info a { font-weight:600; text-decoration:none; }
      ecosystem-rankings .er-desc { font-size:.85rem; color:var(--text-muted-color,#777); margin-top:.15rem; }
      ecosystem-rankings .er-score { text-align:right; white-space:nowrap; font-weight:700; font-variant-numeric:tabular-nums; }
      ecosystem-rankings .er-score small { display:block; font-size:.72rem; color:var(--text-muted-color,#777); font-weight:400; }
      ecosystem-rankings .er-updated { display:block; margin-top:.8rem; color:var(--text-muted-color,#777); font-size:.8rem; }
    </style><div class="er-controls"><label>분야 <select data-category aria-label="랭킹 분야">${categories.map(c => `<option value="${escape(c.id)}" ${c.id === category?.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></label><label>기간 <select data-period aria-label="랭킹 기간">${(this.data.periods || [0,7,30]).map(id => => `<option value="${id}" ${id === this.period ? 'selected' : ''} >${id === 0 ? '전체' : id === 7 ? '주간 (7일)' : id === 30 ? '월간 (30일)' : id + '일'}</option>`).join('')}</select></label></div>${list}<small class="er-updated">마지막 수집: ${escape(this.data.updatedAt || '알 수 없음')}</small>`;
    this.querySelector('[data-category]')?.addEventListener('change', event => { this.category = event.target.value; this.render(); });
    this.querySelector('[data-period]')?.addEventListener('change', event => { this.period = event.target.value; this.render(); });
  }
}
if (!customElements.get('ecosystem-rankings')) customElements.define('ecosystem-rankings', EcosystemRankings);
