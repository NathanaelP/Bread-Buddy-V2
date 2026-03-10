// Production Calculator — Bread Buddy
const TYPE_KEY = "bread_types_v1";
const INPUT_KEY = "prod_inputs_v1";

const DEFAULT_TYPES = [
  { id: "default-white",     name: "White",      pct: 61 },
  { id: "default-wheat",     name: "Wheat",      pct: 8  },
  { id: "default-multigrain",name: "Multigrain", pct: 14 },
  { id: "default-softwhite", name: "Soft White", pct: 17 },
];

// ---- Storage helpers ----

function loadTypes() {
  try {
    const raw = localStorage.getItem(TYPE_KEY);
    if (!raw) return DEFAULT_TYPES.map(t => ({ ...t }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TYPES.map(t => ({ ...t }));
    return parsed.filter(t => t && typeof t.id === "string");
  } catch { return DEFAULT_TYPES.map(t => ({ ...t })); }
}

function saveTypes(types) {
  localStorage.setItem(TYPE_KEY, JSON.stringify(types, null, 2));
}

function loadInputs() {
  try {
    const raw = localStorage.getItem(INPUT_KEY);
    if (!raw) return { total: "", morningPct: "" };
    const parsed = JSON.parse(raw);
    return {
      total: parsed.total ?? "",
      morningPct: parsed.morningPct ?? ""
    };
  } catch { return { total: "", morningPct: "" }; }
}

function saveInputs(total, morningPct) {
  localStorage.setItem(INPUT_KEY, JSON.stringify({ total, morningPct }));
}

function prodUuid() {
  return "p-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function escapeHtmlProd(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ---- Render allocation table ----

function renderAlloc() {
  const wrap = document.getElementById("allocWrap");
  const total = Number(document.getElementById("totalLoaves").value);
  const morningPct = Number(document.getElementById("morningPct").value);
  const types = loadTypes();

  wrap.innerHTML = "";

  if (!total || total <= 0) {
    const p = document.createElement("p");
    p.className = "emptyState";
    p.textContent = "Enter total loaves above to see allocation.";
    wrap.appendChild(p);
    return;
  }

  const pctSum = types.reduce((s, t) => s + t.pct, 0);
  const pctOk = Math.abs(pctSum - 100) < 0.1;

  if (!pctOk) {
    const warn = document.createElement("div");
    warn.className = "allocRow warning";
    warn.textContent = `⚠ Bread type percentages sum to ${pctSum.toFixed(1)}% — they should total 100%.`;
    wrap.appendChild(warn);
  }

  // Header row
  const header = document.createElement("div");
  header.className = "allocRow header";
  header.innerHTML = `<span>Type</span><span>%</span><span>Total</span><span>Morning</span><span>Afternoon</span>`;
  wrap.appendChild(header);

  let sumLoaves = 0, sumMorning = 0, sumAfternoon = 0;

  for (const t of types) {
    const loaves   = Math.round(total * (t.pct / 100));
    const morning  = Math.round(loaves * (morningPct / 100));
    const afternoon = loaves - morning;

    sumLoaves   += loaves;
    sumMorning  += morning;
    sumAfternoon += afternoon;

    const row = document.createElement("div");
    row.className = "allocRow";
    row.innerHTML = `
      <span>${escapeHtmlProd(t.name)}</span>
      <span>${t.pct}%</span>
      <span>${loaves}</span>
      <span>${morning}</span>
      <span>${afternoon}</span>
    `;
    wrap.appendChild(row);
  }

  // Totals row
  const totRow = document.createElement("div");
  totRow.className = "allocRow total";
  totRow.innerHTML = `
    <span>Total</span>
    <span>${pctSum.toFixed(1)}%</span>
    <span>${sumLoaves}</span>
    <span>${sumMorning}</span>
    <span>${sumAfternoon}</span>
  `;
  wrap.appendChild(totRow);
}

// ---- Render bread type management list ----

function renderTypes() {
  const wrap = document.getElementById("typesWrap");
  const types = loadTypes();
  wrap.innerHTML = "";

  if (types.length === 0) {
    const p = document.createElement("p");
    p.className = "emptyState";
    p.textContent = "No bread types. Add one above.";
    wrap.appendChild(p);
    return;
  }

  for (const t of types) {
    const card = document.createElement("div");
    card.className = "itemCard";
    card.innerHTML = `
      <div class="itemTop">
        <p class="itemName">${escapeHtmlProd(t.name)}</p>
      </div>
      <div class="metaRow">
        <div class="meta">
          <p class="metaLabel">% of Total</p>
          <p class="metaValue">${t.pct}%</p>
        </div>
      </div>
      <div class="actionsRow">
        <button class="actionBtn" data-type-action="edit" data-type-id="${t.id}">Edit</button>
        <button class="actionBtn danger" data-type-action="del" data-type-id="${t.id}">Delete</button>
      </div>
    `;
    wrap.appendChild(card);
  }
}

// ---- Form helpers ----

function showTypeForm() {
  document.getElementById("typeForm").style.display = "";
}

function hideTypeForm() {
  document.getElementById("typeForm").style.display = "none";
  document.getElementById("typeEditId").value = "";
  document.getElementById("typeName").value = "";
  document.getElementById("typePct").value = "";
}

// ---- Events ----

document.getElementById("totalLoaves").addEventListener("input", () => {
  saveInputs(
    document.getElementById("totalLoaves").value,
    document.getElementById("morningPct").value
  );
  renderAlloc();
});

document.getElementById("morningPct").addEventListener("input", () => {
  saveInputs(
    document.getElementById("totalLoaves").value,
    document.getElementById("morningPct").value
  );
  renderAlloc();
});

document.getElementById("addTypeBtn").addEventListener("click", () => {
  document.getElementById("typeEditId").value = "";
  document.getElementById("saveTypeBtn").textContent = "Save Type";
  showTypeForm();
  document.getElementById("typeName").focus();
});

document.getElementById("cancelTypeBtn").addEventListener("click", hideTypeForm);

document.getElementById("typeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("typeName").value.trim();
  const pct  = parseFloat(document.getElementById("typePct").value);

  if (!name || !Number.isFinite(pct) || pct < 0) return;

  const types = loadTypes();
  const editId = document.getElementById("typeEditId").value;
  const id = editId || prodUuid();

  const item = { id, name, pct };
  const idx = types.findIndex(t => t.id === id);
  if (idx >= 0) types[idx] = item;
  else types.push(item);

  saveTypes(types);
  hideTypeForm();
  renderTypes();
  renderAlloc();
});

document.getElementById("typesWrap").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.dataset.typeAction;
  const id     = btn.dataset.typeId;
  const types  = loadTypes();
  const item   = types.find(t => t.id === id);
  if (!item) return;

  if (action === "edit") {
    document.getElementById("typeEditId").value = item.id;
    document.getElementById("typeName").value   = item.name;
    document.getElementById("typePct").value    = item.pct;
    document.getElementById("saveTypeBtn").textContent = "Update Type";
    showTypeForm();
    document.getElementById("typeName").focus();
  }

  if (action === "del") {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const next = types.filter(t => t.id !== id);
    saveTypes(next);
    renderTypes();
    renderAlloc();
  }
});

// ---- Init ----

(function initProduction() {
  const saved = loadInputs();
  if (saved.total !== "")      document.getElementById("totalLoaves").value = saved.total;
  if (saved.morningPct !== "") document.getElementById("morningPct").value  = saved.morningPct;
  renderTypes();
  renderAlloc();
})();
