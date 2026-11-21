const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
class EcosystemRankings extends HTMLElement {
  connectedCallback() { this.load(); }
  async load() {
    const src = this.getAttribute('src');
    if (!src) { this.textContent = 'Missing src attribute'; return; }
    try {
      const response = await fetch(src);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      this.data = await response.json();
      this.category = this.data.categories?.[0]?.id;
      this.period = 'all';
      this.render();
    } catch (error) { this.textContent = `Rankings unavailable: ${error.message}`; }
  }
  render() {
    const categories = this.data.categories || [];
    const category = categories.find(c => c.id === this.category) || categories[0];
    const items = [...(category?.items || [])].filter(item => this.period === 'all' || item[this.period] !== null && item[this.period] !== undefined).sort((a,b) => (b[this.period === 'all' ? 'stars' : this.period] || 0) - (a[this.period === 'all' ? 'stars' : this.period] || 0));
    const hasPeriod = this.period === 'all' || items.length > 0;
    this.innerHTML = `<div style="font:inherit;color:inherit"><label>분야 <select data-category>${categories.map(c=>`<option value="${escape(c.id)}" ${c.id===category?.id?'selected':''}>${escape(c.name)}</option>`).join('')}</select></label> <label>기간 <select data-period>${[['all','전체'],['week','주간'],['month','월간']].map(([id,label])=>`<option value="${id}" ${id===this.period?'selected':''}>${label}</option>`).join('')}</select></label><ol>${hasPeriod ? items.map(item=>`<li><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.name)}</a> — ${Number(item[this.period==='all'?'stars':this.period]).toLocaleString()} ${this.period==='all'?'Stars':'신규 Stars'} <small>${escape(item.description)}</small></li>`).join('') : '<li>기간별 데이터 집계 중</li>'}</ol><small>갱신: ${escape(this.data.updatedAt || '')}</small></div>`;
    this.querySelector('[data-category]')?.addEventListener('change', e=>{this.category=e.target.value;this.render();});
    this.querySelector('[data-period]')?.addEventListener('change', e=>{this.period=e.target.value;this.render();});
  }
}
if (!customElements.get('ecosystem-rankings')) customElements.define('ecosystem-rankings', EcosystemRankings);
