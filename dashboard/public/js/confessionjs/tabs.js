// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['core','review','embed','behaviour','filter','categories','access'];

export function switchTab(tab) {
  TABS.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn  = document.getElementById(`tab-${t}`);
    if (view) view.classList.toggle('hidden', t !== tab);
    if (btn)  btn.classList.toggle('active',  t === tab);
  });
}