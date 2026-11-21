const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => Number(value).toLocaleString();
const categoryLabel = category => category?.id === 'tmux-plugins' ? 'Tmux Plugins' : category?.name ?? '';
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
    const eligible = [...(category?.items || [])].filter(item => this.period === '0' || Number.isFinite(value(item)));
    const fallback = this.period !== '0' && eligible.length === 0 && (category?.items?.length || 0) > 0;
    const score = item => fallback ? item.stars : value(item);
    const items = (fallback ? [...category.items] : eligible).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    const notice = fallback ? `<p class="er-notice" role="status">${escape(this.period)}일 전 기록이 아직 없어 전체 누적 Stars 순위를 임시로 표시합니다. 이력이 쌓이면 자동 전환됩니다.</p>` : '';
    const total = category?.items?.length || 0;
    const list = !category
      ? '<p>등록된 분야가 없습니다.</p>'
      : !items.length
        ? `<p class="er-empty" role="status">${this.period === '0' ? '등록된 프로젝트가 없습니다.' : '이 기간의 기록을 수집하고 있습니다. 데이터가 쌓이면 순위가 표시됩니다.'}</p>`
        : `<ol class="er-list">${items.map((item, i) => `<li class="er-item"><span class="er-rank">${String(i + 1).padStart(2, "0")}</span><div class="er-info"><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.id)}</a><div class="er-desc">${escape(item.description)}</div></div><span class="er-score">${number(score(item))}<small>${this.period === '0' || fallback ? 'Stars' : '+ Stars'}</small></span></li>`).join('')}</ol>`;
    this.innerHTML = `<style>
      ecosystem-rankings { display:block; color:var(--text-color,inherit); --er-border:var(--main-border-color,#dce0e5); --er-muted:var(--text-muted-color,#747b86); }
      ecosystem-rankings .er-shell { border:1px solid var(--er-border); border-radius:14px; overflow:hidden; background:var(--card-bg,transparent); }
      ecosystem-rankings .er-toolbar { padding:1rem 1.15rem; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1rem; border-bottom:1px solid var(--er-border); }
      ecosystem-rankings .er-eyebrow { font-size:.69rem; font-weight:700; letter-spacing:.11em; text-transform:uppercase; color:var(--er-muted); }
      ecosystem-rankings .er-heading { font-size:1.05rem; font-weight:700; margin:.15rem 0 0; }
      ecosystem-rankings .er-controls { display:flex; gap:.55rem; flex-wrap:wrap; align-items:center; }
      ecosystem-rankings label { display:flex; align-items:center; gap:.45rem; font-size:.78rem; color:var(--er-muted); margin:0; }
      ecosystem-rankings select { max-width:100%; padding:.45rem 1.7rem .45rem .65rem; border:1px solid var(--er-border); border-radius:7px; background:var(--main-bg,var(--card-bg,#fff)); color:var(--text-color,inherit); font-size:.84rem; }
      ecosystem-rankings select:focus-visible { outline:2px solid var(--link-color,#448aff); outline-offset:2px; }
      ecosystem-rankings .er-notice { margin:0; padding:.7rem 1.15rem; border-bottom:1px solid var(--er-border); font-size:.82rem; color:var(--er-muted); }
      ecosystem-rankings .er-meta { display:flex; gap:1rem; padding:.6rem 1.15rem; font-size:.75rem; color:var(--er-muted); border-bottom:1px solid var(--er-border); }
      ecosystem-rankings .er-list { padding:0; margin:0; list-style:none; }
      ecosystem-rankings .er-item { display:flex; gap:.9rem; align-items:center; padding:.9rem 1.15rem; border-bottom:1px solid var(--er-border); }
      ecosystem-rankings .er-item:last-child { border-bottom:0; }
      ecosystem-rankings .er-rank { flex:0 0 2rem; font-variant-numeric:tabular-nums; color:var(--er-muted); font-weight:650; font-size:.82rem; }
      ecosystem-rankings .er-info { flex:1; min-width:0; overflow-wrap:anywhere; }
      ecosystem-rankings .er-info a { font-weight:650; font-size:.94rem; text-decoration:none; }
      ecosystem-rankings .er-desc { font-size:.8rem; color:var(--er-muted); margin-top:.17rem; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
      ecosystem-rankings .er-score { text-align:right; white-space:nowrap; font-weight:700; font-size:.95rem; font-variant-numeric:tabular-nums; }
      ecosystem-rankings .er-score small { display:block; font-size:.7rem; color:var(--er-muted); font-weight:400; }
      ecosystem-rankings .er-empty { padding:2.5rem 1rem; text-align:center; color:var(--er-muted); }
      ecosystem-rankings .er-footer { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding:.7rem 1.15rem; border-top:1px solid var(--er-border); font-size:.73rem; color:var(--er-muted); }
      @media(max-width:640px) { ecosystem-rankings .er-toolbar { align-items:stretch; } ecosystem-rankings .er-controls { width:100%; } ecosystem-rankings label { flex:1; } ecosystem-rankings select { width:100%; } ecosystem-rankings .er-item { padding:.8rem; gap:.55rem; } ecosystem-rankings .er-rank { flex-basis:1.5rem; } }
    </style><div class="er-shell"><div class="er-toolbar"><div><div class="er-eyebrow">OPEN SOURCE / RANKINGS</div><div class="er-heading">Discover by ecosystem</div></div><div class="er-controls"><label>분야 <select data-category aria-label="랭킹 분야">${categories.map(c => `<option value="${escape(c.id)}" ${c.id === category?.id ? 'selected' : ''}>${escape(categoryLabel(c))}</option>`).join('')}</select></label><label>기간 <select data-period aria-label="랭킹 기간">${(this.data.periods || [0,7,30]).map(id => `<option value="${id}" ${String(id) === this.period ? 'selected' : ''} >${id === 0 ? '전체' : id === 7 ? '주간 (7일)' : id === 30 ? '월간 (30일)' : id + '일'}</option>`).join('')}</select></label></div></div>${notice}<div class="er-meta"><span>${total} repositories tracked</span><span>${this.period === "0" || fallback ? "Cumulative stars" : `${this.period}-day star growth`}</span></div>${list}<div class="er-footer"><span>GitHub Stars · discovery ranking</span><span>Updated ${escape(this.data.updatedAt ? new Date(this.data.updatedAt).toLocaleDateString("ko-KR") : "—")}</span></div></div>`;
    this.querySelector('[data-category]')?.addEventListener('change', event => { this.category = event.target.value; this.render(); });
    this.querySelector('[data-period]')?.addEventListener('change', event => { this.period = event.target.value; this.render(); });
  }
}
if (!customElements.get('ecosystem-rankings')) customElements.define('ecosystem-rankings', EcosystemRankings);
