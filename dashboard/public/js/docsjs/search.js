// docsjs/search.js — Full-text search across guides, sections, tags, and FAQs
// ─────────────────────────────────────────────────────────────────────────────
import { GUIDES, CATEGORIES } from './data.js';
import { FAQS } from './faq.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function score(haystack, needles) {
  let s = 0;
  for (const n of needles) {
    if (haystack.includes(n)) s += n.length > 3 ? 2 : 1;
  }
  return s;
}

function highlight(text, needles) {
  let out = text;
  for (const n of needles) {
    if (!n) continue;
    const re = new RegExp(`(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

// ── Build flat index on first call ───────────────────────────────────────────

let _index = null;

function buildIndex() {
  if (_index) return _index;
  _index = [];

  for (const [gid, g] of Object.entries(GUIDES)) {
    const cat = CATEGORIES.find(c => c.guides.includes(gid));

    // Guide-level entry
    _index.push({
      type:    'guide',
      guide:   gid,
      section: null,
      title:   g.name,
      sub:     g.desc,
      icon:    g.icon,
      color:   g.color,
      catColor: cat?.color || g.color,
      // searchable blob
      blob: norm([g.name, g.desc, ...(g.tags || [])].join(' ')),
    });

    // Section-level entries
    for (const s of g.sections || []) {
      _index.push({
        type:    'section',
        guide:   gid,
        section: s.id,
        title:   s.title,
        sub:     g.name,
        icon:    g.icon,
        color:   g.color,
        catColor: cat?.color || g.color,
        blob: norm([s.title, g.name].join(' ')),
      });
    }

    // FAQ entries
    for (const faq of FAQS[gid] || []) {
      _index.push({
        type:    'faq',
        guide:   gid,
        section: 'faq',
        title:   faq.q,
        sub:     g.name + ' · FAQ',
        icon:    'help-circle',
        color:   g.color,
        catColor: cat?.color || g.color,
        blob: norm(faq.q + ' ' + faq.a),
      });
    }
  }

  return _index;
}

// ── Public: search(query) → hits[] ───────────────────────────────────────────

export function search(query) {
  const index   = buildIndex();
  const needles = norm(query).split(/\s+/).filter(n => n.length >= 2);
  if (!needles.length) return [];

  const scored = [];
  const seenGuides = new Set();

  for (const entry of index) {
    const s = score(entry.blob, needles);
    if (!s) continue;

    // Boost: guide-level results score higher
    const boost = entry.type === 'guide' ? 2 : entry.type === 'section' ? 1 : 0.5;

    // De-duplicate: only one result per guide unless it's a specific section hit
    const dedupeKey = entry.type === 'guide' ? 'guide:' + entry.guide : entry.guide + ':' + entry.section;

    scored.push({ ...entry, _score: s * boost, _key: dedupeKey });
  }

  // Sort by score desc, deduplicate by key
  scored.sort((a, b) => b._score - a._score);

  const seen = new Set();
  const out  = [];
  for (const hit of scored) {
    if (seen.has(hit._key)) continue;
    seen.add(hit._key);
    out.push(hit);
    if (out.length >= 8) break;
  }

  return out;
}

// ── Public: renderSearchResults(hits, query) → HTML string ───────────────────

export function renderSearchResults(hits, query) {
  if (!hits.length) {
    return `<div style="padding:.75rem 1rem;font-size:.72rem;color:var(--muted)">No results for <strong>${
      query.replace(/</g, '&lt;')
    }</strong></div>`;
  }

  const needles = norm(query).split(/\s+/).filter(n => n.length >= 2);

  return hits.map(hit => {
    const title = highlight(hit.title, needles);
    const sub   = hit.sub;
    const badge = hit.type === 'faq' ? '<span style="font-size:.58rem;background:rgba(108,83,255,.15);color:#a78bff;border-radius:.25rem;padding:1px 5px;margin-left:.4rem;vertical-align:middle">FAQ</span>' : '';

    return `
      <div class="search-result" data-guide="${hit.guide}" data-section="${hit.section || ''}" role="option" tabindex="-1">
        <div class="search-result-icon" style="background:${hit.catColor}1a;border:1px solid ${hit.catColor}33">
          <i data-lucide="${hit.icon}" style="width:13px;height:13px;color:${hit.catColor}"></i>
        </div>
        <div style="min-width:0">
          <span class="search-result-title">${title}${badge}</span>
          <span class="search-result-sub">${sub}</span>
        </div>
      </div>`;
  }).join('');
}