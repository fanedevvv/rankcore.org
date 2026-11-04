// devjs/reports.js — Report management for the dev panel

import { secureFetch, escapeHtml, showToast } from './core.js';

export let rawReports = [];
let currentPage = 1;
let totalReports = 0;
const PAGE_SIZE = 50;

// Active filters
let filters = { status: 'open', type: 'all', category: 'all', search: '' };

const CATEGORY_LABELS = {
    abuse:         '🔴 Abuse',
    spam:          '📨 Spam',
    scam:          '💸 Scam',
    impersonation: '🎭 Impersonation',
    nsfw:          '🔞 NSFW',
    cheating:      '🎮 Cheating',
    other:         '❓ Other',
};

const CATEGORY_COLORS = {
    abuse: '#ef4444', spam: '#f97316', scam: '#eab308',
    impersonation: '#a855f7', nsfw: '#ec4899', cheating: '#3b82f6', other: '#64748b',
};

const STATUS_CONFIG = {
    open:      { label: 'Open',      color: '#eab308', dot: '🟡' },
    reviewing: { label: 'Reviewing', color: '#3b82f6', dot: '🔵' },
    resolved:  { label: 'Resolved',  color: '#ef4444', dot: '🟢' },
    dismissed: { label: 'Dismissed', color: '#64748b', dot: '⚫' },
};

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Render report list ────────────────────────────────────────────────────────

function renderReportList(reports) {
    const el = document.getElementById('reportsList');
    if (!el) return;

    if (!reports.length) {
        el.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:0.8rem;font-weight:700">
            No reports found for these filters
        </div>`;
        return;
    }

    el.innerHTML = reports.map(r => {
        const sc     = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.open;
        const cc     = CATEGORY_COLORS[r.category] ?? '#64748b';
        const cl     = CATEGORY_LABELS[r.category] ?? r.category;
        const target = r.targetType === 'user' ? `👤 ${r.targetId}` : `🏰 ${r.targetId}`;
        const isOpen = r.status === 'open' || r.status === 'reviewing';

        return `<div class="premium-row report-row" data-id="${escapeHtml(r.reportId)}" onclick="openReport('${escapeHtml(r.reportId)}')">
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                    <code style="font-size:0.65rem;color:var(--muted)">${escapeHtml(r.reportId)}</code>
                    <span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:6px;background:${cc}22;color:${cc};border:1px solid ${cc}44">${cl}</span>
                    <span style="font-size:0.6rem;font-weight:700;color:${sc.color}">${sc.dot} ${sc.label}</span>
                    <span style="font-size:0.6rem;color:var(--muted)">${r.targetType === 'guild' ? '🏰 Server' : '👤 User'}</span>
                </div>
                <div style="font-size:0.78rem;color:var(--text2);margin-bottom:3px">
                    <strong>Target:</strong> <code>${escapeHtml(r.targetId)}</code>
                    &nbsp;·&nbsp;<strong>Reporter:</strong> <code>${escapeHtml(r.reporterId)}</code>
                </div>
                <div style="font-size:0.75rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px">
                    ${escapeHtml(r.reason?.slice(0, 100) ?? '')}${(r.reason?.length ?? 0) > 100 ? '…' : ''}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
                <span style="font-size:0.65rem;color:var(--muted)">${fmtDate(r.createdAt)}</span>
                <div style="display:flex;gap:5px">
                    ${isOpen ? `<button class="btn btn-ghost sm" onclick="event.stopPropagation();markReviewing('${escapeHtml(r.reportId)}')">Review</button>` : ''}
                    <button class="btn btn-green sm" onclick="event.stopPropagation();openResolveModal('${escapeHtml(r.reportId)}','resolved')">Resolve</button>
                    <button class="btn btn-ghost sm" onclick="event.stopPropagation();openResolveModal('${escapeHtml(r.reportId)}','dismissed')">Dismiss</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Update stat badges ────────────────────────────────────────────────────────

function updateBadges(openCount, reviewingCount) {
    const openBadge  = document.getElementById('reports-open-badge');
    const revBadge   = document.getElementById('reports-reviewing-badge');
    const tabBadge   = document.getElementById('reports-tab-badge');
    if (openBadge)  openBadge.textContent  = openCount;
    if (revBadge)   revBadge.textContent   = reviewingCount;
    if (tabBadge)   tabBadge.textContent   = openCount + reviewingCount > 0 ? openCount + reviewingCount : '';
    // Update nav tab unread dot
    const dot = document.getElementById('reports-nav-dot');
    if (dot) dot.style.display = (openCount + reviewingCount) > 0 ? 'block' : 'none';
}

// ── Load reports ──────────────────────────────────────────────────────────────

export async function loadReports(page = 1) {
    currentPage = page;
    const params = new URLSearchParams({
        page,
        limit:    PAGE_SIZE,
        status:   filters.status,
        type:     filters.type,
        category: filters.category,
        search:   filters.search,
    });

    try {
        const data = await secureFetch(`/api-dev/reports?${params}`).then(r => r.json());
        rawReports  = data.reports ?? [];
        totalReports = data.total ?? 0;

        renderReportList(rawReports);
        updateBadges(data.openCount ?? 0, data.reviewingCount ?? 0);
        renderPagination();
    } catch (e) {
        console.error('[DEV] loadReports error:', e);
        showToast('Failed to load reports', true);
    }
}

// ── Pagination ────────────────────────────────────────────────────────────────

function renderPagination() {
    const el = document.getElementById('reports-pagination');
    if (!el) return;
    const pages = Math.ceil(totalReports / PAGE_SIZE);
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;justify-content:center;font-size:0.8rem;color:var(--muted)">`;
    html += `<button class="btn btn-ghost sm" onclick="loadReports(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>`;
    html += `<span>Page ${currentPage} of ${pages} · ${totalReports} reports</span>`;
    html += `<button class="btn btn-ghost sm" onclick="loadReports(${currentPage + 1})" ${currentPage >= pages ? 'disabled' : ''}>Next →</button>`;
    html += `</div>`;
    el.innerHTML = html;
}

// ── Filter controls ───────────────────────────────────────────────────────────

export function setReportFilter(key, value) {
    filters[key] = value;
    loadReports(1);
}

export function searchReports() {
    filters.search = document.getElementById('searchReports')?.value?.trim() ?? '';
    loadReports(1);
}

// ── Open report detail modal ─────────────────────────────────────────────────

export async function openReport(reportId) {
    try {
        const r = await secureFetch(`/api-dev/reports/${reportId}`).then(d => d.json());
        if (r.error) return showToast(r.error, true);

        const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.open;
        const cl = CATEGORY_LABELS[r.category] ?? r.category;

        const modal = document.getElementById('report-detail-modal');
        const body  = document.getElementById('report-detail-body');
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
                <div class="detail-field"><div class="df-label">Report ID</div><code class="df-val">${escapeHtml(r.reportId)}</code></div>
                <div class="detail-field"><div class="df-label">Status</div><div class="df-val" style="color:${sc.color}">${sc.dot} ${sc.label}</div></div>
                <div class="detail-field"><div class="df-label">Type</div><div class="df-val">${r.targetType === 'guild' ? '🏰 Server' : '👤 User'}</div></div>
                <div class="detail-field"><div class="df-label">Category</div><div class="df-val">${cl}</div></div>
                <div class="detail-field"><div class="df-label">Target ID</div><code class="df-val">${escapeHtml(r.targetId)}</code></div>
                <div class="detail-field"><div class="df-label">Reporter ID</div><code class="df-val">${escapeHtml(r.reporterId)}</code></div>
                <div class="detail-field"><div class="df-label">Submitted</div><div class="df-val">${fmtDate(r.createdAt)}</div></div>
                ${r.guildId ? `<div class="detail-field"><div class="df-label">Guild Context</div><code class="df-val">${escapeHtml(r.guildId)}</code></div>` : ''}
            </div>
            <div class="detail-field" style="margin-bottom:10px">
                <div class="df-label">Reason</div>
                <div class="df-val" style="white-space:pre-wrap;font-size:0.82rem;line-height:1.5">${escapeHtml(r.reason)}</div>
            </div>
            ${r.evidence ? `<div class="detail-field" style="margin-bottom:10px">
                <div class="df-label">Evidence</div>
                <div class="df-val"><a href="${escapeHtml(r.evidence)}" target="_blank" rel="noopener" style="color:var(--accent)">${escapeHtml(r.evidence)}</a></div>
            </div>` : ''}
            ${r.resolution?.action ? `
            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
                <div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:8px">Resolution</div>
                <div class="detail-field" style="margin-bottom:8px"><div class="df-label">Action Taken</div><div class="df-val">${escapeHtml(r.resolution.action)}</div></div>
                ${r.resolution.devNote ? `<div class="detail-field" style="margin-bottom:8px"><div class="df-label">Dev Note (internal)</div><div class="df-val">${escapeHtml(r.resolution.devNote)}</div></div>` : ''}
                <div class="detail-field"><div class="df-label">Resolved At</div><div class="df-val">${fmtDate(r.resolution.resolvedAt)}</div></div>
                <div class="detail-field" style="margin-top:6px"><div class="df-label">Reporter DM Sent</div><div class="df-val" style="color:${r.resolution.dmSent ? '#ef4444' : '#f87171'}">${r.resolution.dmSent ? '✓ Yes' : '✗ No'}</div></div>
            </div>` : ''}
            ${(r.status === 'open' || r.status === 'reviewing') ? `
            <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:8px">
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-ghost sm" onclick="markReviewing('${escapeHtml(r.reportId)}')">Mark Reviewing</button>
                    <button class="btn btn-green sm" onclick="openResolveModal('${escapeHtml(r.reportId)}','resolved')">✓ Resolve</button>
                    <button class="btn btn-ghost sm" onclick="openResolveModal('${escapeHtml(r.reportId)}','dismissed')">Dismiss</button>
                </div>
            </div>` : ''}
        `;

        modal.classList.add('open');
    } catch (e) {
        showToast('Failed to load report detail', true);
    }
}

export function closeReportDetail() {
    document.getElementById('report-detail-modal')?.classList.remove('open');
}

// ── Mark as reviewing ─────────────────────────────────────────────────────────

export async function markReviewing(reportId) {
    const res = await secureFetch(`/api-dev/reports/${reportId}/status`, {
        method: 'POST', body: JSON.stringify({ status: 'reviewing' }),
    }).then(r => r.json());
    if (res.error) return showToast(res.error, true);
    showToast('Marked as reviewing');
    loadReports(currentPage);
}

// ── Resolve modal ─────────────────────────────────────────────────────────────

let _pendingResolve = null;

export function openResolveModal(reportId, status) {
    _pendingResolve = { reportId, status };
    const modal     = document.getElementById('resolve-report-modal');
    const title     = document.getElementById('resolve-modal-title');
    const actionEl  = document.getElementById('resolve-action');
    const noteEl    = document.getElementById('resolve-note');
    if (!modal) return;

    title.textContent = status === 'resolved' ? '✅ Resolve Report' : '⚫ Dismiss Report';
    if (actionEl) actionEl.value = '';
    if (noteEl)   noteEl.value   = '';
    modal.classList.add('open');

    // Close the detail modal if open
    document.getElementById('report-detail-modal')?.classList.remove('open');
}

export function closeResolveModal() {
    document.getElementById('resolve-report-modal')?.classList.remove('open');
    _pendingResolve = null;
}

export async function submitResolve() {
    if (!_pendingResolve) return;
    const { reportId, status } = _pendingResolve;
    const action  = document.getElementById('resolve-action')?.value.trim();
    const devNote = document.getElementById('resolve-note')?.value.trim();

    if (!action) return showToast('Action description is required', true);

    const btn = document.getElementById('resolve-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const res = await secureFetch(`/api-dev/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action, devNote, status }),
    }).then(r => r.json());

    if (btn) { btn.disabled = false; btn.textContent = 'Confirm'; }

    if (res.error) return showToast(res.error, true);

    const dmMsg = res.dmSent ? ' · Reporter DM sent ✓' : ' · DM failed (DMs disabled)';
    showToast(`Report ${status}${dmMsg}`);
    closeResolveModal();
    loadReports(currentPage);
}

// ── Load stats ────────────────────────────────────────────────────────────────

export async function loadReportStats() {
    try {
        const data = await secureFetch('/api-dev/reports/stats').then(r => r.json());
        const el   = document.getElementById('report-stats-content');
        if (!el) return;

        const rows = data.byCategory?.map(c =>
            `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.8rem;border-bottom:1px solid var(--border)">
                <span style="color:var(--text2)">${CATEGORY_LABELS[c.category] ?? c.category}</span>
                <span style="font-weight:700;color:var(--text)">${c.count}</span>
            </div>`
        ).join('') ?? '';

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
                ${[
                    ['Total', data.total ?? 0, 'var(--text)'],
                    ['Open', data.open ?? 0, '#eab308'],
                    ['Reviewing', data.reviewing ?? 0, '#3b82f6'],
                    ['Resolved', data.resolved ?? 0, '#ef4444'],
                ].map(([l, v, c]) => `<div style="text-align:center;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:10px">
                    <div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">${l}</div>
                    <div style="font-size:1.3rem;font-weight:700;color:${c}">${v}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px">By Category</div>
            ${rows}
        `;
    } catch {}
}