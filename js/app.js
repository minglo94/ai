/* ─── State ─────────────────────────────────────────────────────────────── */
const state = {
  currentSubject: "all",
  currentType:    "all",
  searchQuery:    ""
};

/* ─── DOM refs ──────────────────────────────────────────────────────────── */
const subjectNav    = document.getElementById("subject-nav");
const typeTabs      = document.getElementById("type-tabs");
const searchInput   = document.getElementById("search-input");
const searchClear   = document.getElementById("search-clear");
const promptGrid    = document.getElementById("prompt-grid");
const emptyState    = document.getElementById("empty-state");
const resultSummary = document.getElementById("result-summary");
const totalCount    = document.getElementById("total-count");
const toast         = document.getElementById("toast");

// Modal
const modalBackdrop  = document.getElementById("modal-backdrop");
const modalClose     = document.getElementById("modal-close");
const modalBadges    = document.getElementById("modal-badges");
const modalTitle     = document.getElementById("modal-title");
const modalInputs    = document.getElementById("modal-inputs");
const modalPromptTxt = document.getElementById("modal-prompt-text");
const btnCopyModal   = document.getElementById("btn-copy-modal");

/* ─── Build subject nav ─────────────────────────────────────────────────── */
function buildSubjectNav() {
  SUBJECTS.forEach(({ id, label, color }) => {
    const btn = document.createElement("button");
    btn.className = "subject-pill" + (id === "all" ? " active" : "");
    btn.dataset.subject = id;

    if (id !== "all") {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;
      btn.appendChild(dot);
    }
    btn.appendChild(document.createTextNode(label));

    if (id === "all") {
      btn.style.background = "#1A202C";
      btn.style.color = "#fff";
    } else {
      btn.style.borderColor = color + "40";
    }
    subjectNav.appendChild(btn);
  });
}

/* ─── Filter & Render ───────────────────────────────────────────────────── */
function filterAndRender() {
  const q = state.searchQuery.toLowerCase();

  const filtered = PROMPTS_DATA.filter(p => {
    const matchSubject = state.currentSubject === "all" || p.subject === state.currentSubject;
    const matchType    = state.currentType    === "all" || p.type    === state.currentType;
    const matchSearch  = !q ||
      p.title.toLowerCase().includes(q) ||
      p.prompt.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q));
    return matchSubject && matchType && matchSearch;
  });

  const total = PROMPTS_DATA.length;
  resultSummary.textContent = filtered.length === total
    ? `顯示全部 ${total} 條指令`
    : `顯示 ${filtered.length} / ${total} 條指令`;

  emptyState.hidden = filtered.length > 0;
  promptGrid.hidden = filtered.length === 0;

  promptGrid.innerHTML = "";
  filtered.forEach((p, idx) => {
    promptGrid.appendChild(createCard(p, idx));
  });
}

/* ─── Card Factory ──────────────────────────────────────────────────────── */
function createCard(p, idx) {
  const subj      = SUBJECTS.find(s => s.id === p.subject);
  const color     = subj ? subj.color : "#607D8B";
  const subjLabel = subj ? subj.label : p.subject;
  
  let typeLabel = "未知";
  let typeCls   = "";
  if (p.type === "preview") {
    typeLabel = "預習";
    typeCls   = "badge-type-preview";
  } else if (p.type === "review") {
    typeLabel = "複習";
    typeCls   = "badge-type-review";
  } else if (p.type === "inlesson") {
    typeLabel = "課堂";
    typeCls   = "badge-type-inlesson";
  }


  const card = document.createElement("div");
  card.className = "prompt-card";
  card.setAttribute("role", "listitem");
  card.style.animationDelay = `${idx * 30}ms`;

  const previewText = escapeHtml(p.prompt.slice(0, 180));

  card.innerHTML = `
    <div class="card-color-bar" style="background:${color}"></div>
    <div class="card-body">
      <div class="card-badges">
        <span class="badge badge-subject" style="background:${color}">${escapeHtml(subjLabel)}</span>
        <span class="badge ${typeCls}">${typeLabel}</span>
      </div>
      <h2 class="card-title">${escapeHtml(p.title)}</h2>
      <p class="card-prompt-preview">${previewText}…</p>
      <div class="card-tags">
        ${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button class="btn-view" data-id="${escapeHtml(p.id)}">🔍 查看 &amp; 填寫</button>
        <button class="btn-copy" data-id="${escapeHtml(p.id)}" title="直接複製（不填關鍵字）">📋</button>
      </div>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Placeholder Parsing ───────────────────────────────────────────────── */
// Matches 【在此填上…】 — captures the hint text inside
const PH_RE = /【在此填上([^】]*)】/g;

/**
 * Extract unique placeholders from a prompt string.
 * Returns array of { key, hint, original }
 *   key      — normalised key used as data-key on inputs
 *   hint     — the text inside 【在此填上…】
 *   original — the full match string
 */
function extractPlaceholders(prompt) {
  const seen = new Set();
  const result = [];
  let m;
  PH_RE.lastIndex = 0;
  while ((m = PH_RE.exec(prompt)) !== null) {
    const original = m[0];
    const hint     = m[1].trim();
    const key      = hint || original;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ key, hint, original });
    }
  }
  return result;
}

/**
 * Build a version of the prompt with values substituted.
 * If a value is empty, the original placeholder is kept.
 */
function buildFilledPrompt(prompt, values) {
  PH_RE.lastIndex = 0;
  return prompt.replace(PH_RE, (match, hint) => {
    const key = hint.trim() || match;
    return values[key] && values[key].trim() ? values[key].trim() : match;
  });
}

/* ─── Modal ─────────────────────────────────────────────────────────────── */
let activePromptId = null;
const modalValues  = {};   // key → user-typed value

function openModal(id) {
  const p = PROMPTS_DATA.find(x => x.id === id);
  if (!p) return;

  activePromptId = id;

  const subj      = SUBJECTS.find(s => s.id === p.subject);
  const color     = subj ? subj.color : "#607D8B";
  const subjLabel = subj ? subj.label : p.subject;
  
  let typeLabel = "未知";
  let typeCls   = "";
  if (p.type === "preview") {
    typeLabel = "預習";
    typeCls   = "badge-type-preview";
  } else if (p.type === "review") {
    typeLabel = "複習";
    typeCls   = "badge-type-review";
  } else if (p.type === "inlesson") {
    typeLabel = "課堂";
    typeCls   = "badge-type-inlesson";
  }


  // Header colour bar via border-bottom
  document.querySelector(".modal-header").style.borderBottomColor = color;
  document.querySelector(".modal-header").style.borderBottomWidth = "4px";
  document.querySelector(".modal-header").style.borderBottomStyle = "solid";

  // Badges
  modalBadges.innerHTML = `
    <span class="badge badge-subject" style="background:${color}">${escapeHtml(subjLabel)}</span>
    <span class="badge ${typeCls}">${typeLabel}</span>
  `;
  modalTitle.textContent = p.title;

  // Extract placeholders & build input fields
  const placeholders = extractPlaceholders(p.prompt);

  // Clear previous values
  Object.keys(modalValues).forEach(k => delete modalValues[k]);

  modalInputs.innerHTML = "";
  if (placeholders.length > 0) {
    const heading = document.createElement("div");
    heading.style.cssText = "font-size:.8rem;font-weight:700;color:var(--clr-text);margin-bottom:4px;";
    heading.textContent = "✏️ 填入你的資料，指令會即時更新：";
    modalInputs.appendChild(heading);

    placeholders.forEach(({ key, hint }) => {
      const row = document.createElement("div");
      row.className = "input-row";

      const label = document.createElement("label");
      label.className = "input-label";
      label.textContent = hint || key;
      label.htmlFor = `ph-${key}`;

      const input = document.createElement("input");
      input.type = "text";
      input.id = `ph-${key}`;
      input.className = "placeholder-input";
      input.placeholder = `例：${hint}`;
      input.dataset.key = key;
      input.value = "";

      input.addEventListener("input", () => {
        modalValues[key] = input.value;
        renderModalPrompt(p.prompt);
      });

      row.appendChild(label);
      row.appendChild(input);
      modalInputs.appendChild(row);
    });
  }

  // Render prompt text
  renderModalPrompt(p.prompt);

  // Reset copy button
  btnCopyModal.textContent = "📋 複製完整指令";
  btnCopyModal.classList.remove("copied");

  // Show modal
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";

  // Focus first input if exists, else close button
  const firstInput = modalInputs.querySelector(".placeholder-input");
  setTimeout(() => (firstInput || modalClose).focus(), 50);
}

function renderModalPrompt(rawPrompt) {
  // Build filled text
  const filled = buildFilledPrompt(rawPrompt, modalValues);

  // Render with highlights: filled values → <mark>, remaining placeholders → .ph-empty
  // We'll build the HTML safely by splitting on placeholders
  let html = "";
  let lastIdx = 0;
  PH_RE.lastIndex = 0;
  let m;
  while ((m = PH_RE.exec(filled)) !== null) {
    // Text before this match
    html += escapeHtml(filled.slice(lastIdx, m.index));
    // The placeholder is still there (not filled), highlight red
    html += `<span class="ph-empty">${escapeHtml(m[0])}</span>`;
    lastIdx = m.index + m[0].length;
  }
  html += escapeHtml(filled.slice(lastIdx));

  // Now highlight filled values (they replaced placeholders, so won't match PH_RE again)
  // We need a different approach: compare original vs filled
  // Instead, highlight filled by doing a second pass on the original
  // Simpler: just render filled text with ph-empty for remaining ones (already done above)
  // For filled values, we want to mark them. Let's rebuild from scratch using original.

  const p = PROMPTS_DATA.find(x => x.id === activePromptId);
  if (!p) return;

  let html2 = "";
  let lastIdx2 = 0;
  PH_RE.lastIndex = 0;
  while ((m = PH_RE.exec(p.prompt)) !== null) {
    html2 += escapeHtml(p.prompt.slice(lastIdx2, m.index));
    const hint = m[1].trim();
    const key  = hint || m[0];
    const val  = modalValues[key] && modalValues[key].trim();
    if (val) {
      html2 += `<mark>${escapeHtml(val)}</mark>`;
    } else {
      html2 += `<span class="ph-empty">${escapeHtml(m[0])}</span>`;
    }
    lastIdx2 = m.index + m[0].length;
  }
  html2 += escapeHtml(p.prompt.slice(lastIdx2));

  modalPromptTxt.innerHTML = html2;
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  activePromptId = null;
}

/* ─── Copy Prompt ───────────────────────────────────────────────────────── */
function copyText(text, btn) {
  const doSuccess = () => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✅ 已複製！";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 2000);
    }
    showToast("✅ 已複製到剪貼板！貼入 Gemini 即可使用。");
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(doSuccess).catch(() => fallbackCopy(text, btn, doSuccess));
  } else {
    fallbackCopy(text, btn, doSuccess);
  }
}

function fallbackCopy(text, btn, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand("copy"); onSuccess(); }
  catch { showToast("⚠️ 複製失敗，請手動選取指令文字"); }
  finally { document.body.removeChild(ta); }
}

function copyRawPrompt(id) {
  const p = PROMPTS_DATA.find(x => x.id === id);
  if (!p) return;
  const btn = promptGrid.querySelector(`.btn-copy[data-id="${id}"]`);
  copyText(p.prompt, btn);
}

/* ─── Toast ─────────────────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

/* ─── Event Listeners ───────────────────────────────────────────────────── */

// Subject pills
subjectNav.addEventListener("click", e => {
  const pill = e.target.closest(".subject-pill");
  if (!pill) return;
  state.currentSubject = pill.dataset.subject;

  subjectNav.querySelectorAll(".subject-pill").forEach(p => {
    p.classList.remove("active");
    p.style.background = "var(--clr-bg)";
    p.style.color = "var(--clr-text)";
  });

  const active = subjectNav.querySelector(`[data-subject="${state.currentSubject}"]`);
  if (active) {
    const subj  = SUBJECTS.find(s => s.id === state.currentSubject);
    const color = subj ? subj.color : "#1A202C";
    active.classList.add("active");
    active.style.background = color;
    active.style.color = "#fff";
    active.style.borderColor = "transparent";
  }
  filterAndRender();
});

// Type tabs
typeTabs.addEventListener("click", e => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  state.currentType = btn.dataset.type;
  typeTabs.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b === btn);
    b.setAttribute("aria-selected", b === btn ? "true" : "false");
  });
  filterAndRender();
});

// Search
searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value.trim();
  searchClear.hidden = !state.searchQuery;
  filterAndRender();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  state.searchQuery = "";
  searchClear.hidden = true;
  searchInput.focus();
  filterAndRender();
});

// Card buttons (event delegation)
promptGrid.addEventListener("click", e => {
  const viewBtn = e.target.closest(".btn-view");
  const copyBtn = e.target.closest(".btn-copy");
  if (viewBtn) openModal(viewBtn.dataset.id);
  if (copyBtn) copyRawPrompt(copyBtn.dataset.id);
});

// Modal — copy filled prompt
btnCopyModal.addEventListener("click", () => {
  const p = PROMPTS_DATA.find(x => x.id === activePromptId);
  if (!p) return;
  const filled = buildFilledPrompt(p.prompt, modalValues);
  copyText(filled, btnCopyModal);
});

// Modal — close
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", e => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

// Reset
document.getElementById("btn-reset").addEventListener("click", () => {
  state.currentSubject = "all";
  state.currentType    = "all";
  state.searchQuery    = "";
  searchInput.value    = "";
  searchClear.hidden   = true;

  subjectNav.querySelectorAll(".subject-pill").forEach(p => {
    p.classList.remove("active");
    p.style.background = "var(--clr-bg)";
    p.style.color = "var(--clr-text)";
  });
  const allPill = subjectNav.querySelector('[data-subject="all"]');
  if (allPill) {
    allPill.classList.add("active");
    allPill.style.background = "#1A202C";
    allPill.style.color = "#fff";
  }
  typeTabs.querySelectorAll(".tab-btn").forEach(b => {
    const isAll = b.dataset.type === "all";
    b.classList.toggle("active", isAll);
    b.setAttribute("aria-selected", isAll ? "true" : "false");
  });
  filterAndRender();
});

/* ─── Init ──────────────────────────────────────────────────────────────── */
function init() {
  buildSubjectNav();
  totalCount.textContent = `${PROMPTS_DATA.length} 條指令`;
  filterAndRender();
}

document.addEventListener("DOMContentLoaded", init);
