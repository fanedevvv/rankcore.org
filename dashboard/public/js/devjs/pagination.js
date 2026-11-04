// devjs/pagination.js

export const PAGE_SIZE = 8;

export function paginate(items, pg, sz = PAGE_SIZE) {
  return items.slice((pg - 1) * sz, pg * sz);
}

export function renderPag(id, cur, total, fnName) {
  const max = Math.ceil(total / PAGE_SIZE) || 1;
  document.getElementById(id).innerHTML =
    `<span>${cur} / ${max}</span>` +
    `<div class="pag-btns">` +
    `<button class="pag-btn" onclick="${fnName}(${cur - 1})" ${cur <= 1 ? 'disabled' : ''}>Prev</button>` +
    `<button class="pag-btn" onclick="${fnName}(${cur + 1})" ${cur * PAGE_SIZE >= total ? 'disabled' : ''}>Next</button>` +
    `</div>`;
}