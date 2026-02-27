// Pantry Dater (PWA) - offline + localStorage
const STORAGE_KEY = "pantry_dater_items_v1";
const DEFAULT_DATA_URL = "data.json"; // prefill list

const el = (id) => document.getElementById(id);

const todayLabel = el("todayLabel");
const refreshBtn = el("refreshBtn");
const itemForm = el("itemForm");
const editId = el("editId");
const productName = el("productName");
const daysAfter = el("daysAfter");
const clearBtn = el("clearBtn");

const searchInput = el("searchInput");
const cardsWrap = el("cardsWrap");

const exportBtn = el("exportBtn");
const importFile = el("importFile");

function startOfLocalDay(d = new Date()) {
  // Normalize so adding days doesn’t drift when DST changes
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLocal(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function formatMdyNoLeadingZeros(dateObj) {
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const y = String(dateObj.getFullYear()).slice(-2);
  return `${m}/${d}/${y}`;
}

function computeLabelDate(days) {
  const base = startOfLocalDay(new Date());
  return addDaysLocal(base, days);
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x.id === "string")
      .map(x => ({
        id: x.id,
        name: String(x.name ?? "").trim(),
        days: Number.isFinite(Number(x.days)) ? Number(x.days) : 0,
        createdAt: x.createdAt ? String(x.createdAt) : new Date().toISOString()
      }));
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items, null, 2));
}

function uuid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function setTodayLabel() {
  const today = startOfLocalDay(new Date());
  todayLabel.textContent = `Today: ${formatMdyNoLeadingZeros(today)}`;
}

function render(items) {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? items.filter(it =>
        it.name.toLowerCase().includes(q) ||
        String(it.days).includes(q)
      )
    : items;

  cardsWrap.innerHTML = "";

  if (filtered.length === 0) {
    const div = document.createElement("div");
    div.className = "emptyState";
    div.textContent = "No items found.";
    cardsWrap.appendChild(div);
    return;
  }

  // Sort alphabetically
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  for (const it of filtered) {
    const labelDate = computeLabelDate(it.days);
    const expires = formatMdyNoLeadingZeros(labelDate);

    const card = document.createElement("div");
    card.className = "itemCard";
    card.innerHTML = `
      <div class="itemTop">
        <p class="itemName">${escapeHtml(it.name)}</p>
      </div>

      <div class="metaRow">
        <div class="meta">
          <p class="metaLabel">Days after thaw</p>
          <p class="metaValue">${it.days}</p>
        </div>
        <div class="meta">
          <p class="metaLabel">Expires (label date)</p>
          <p class="metaValue">${expires}</p>
        </div>
      </div>

      <div class="actionsRow">
        <button class="actionBtn" data-action="edit" data-id="${it.id}">Edit</button>
        <button class="actionBtn danger" data-action="del" data-id="${it.id}">Delete</button>
      </div>
    `;
    cardsWrap.appendChild(card);
  }
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  editId.value = "";
  productName.value = "";
  daysAfter.value = "";
  productName.focus();
  el("saveBtn").textContent = "Save";
}

function upsertItem(items, item) {
  const idx = items.findIndex(x => x.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  return items;
}

// Prefill (first run only): if storage empty, load data.json
async function ensurePrefill() {
  const existing = loadItems();
  if (existing.length > 0) return;

  try {
    const res = await fetch(DEFAULT_DATA_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const parsed = await res.json();
    if (!Array.isArray(parsed)) return;

    const cleaned = parsed
      .map(x => ({
        id: uuid(),
        name: String(x.name ?? "").trim(),
        days: Number.isFinite(Number(x.days)) ? Number(x.days) : 0,
        createdAt: new Date().toISOString()
      }))
      .filter(x => x.name.length > 0);

    if (cleaned.length > 0) saveItems(cleaned);
  } catch {
    // ignore
  }
}

// ---- Events ----
refreshBtn.addEventListener("click", () => {
  setTodayLabel();
  render(loadItems());
});

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = productName.value.trim();
  const days = Number(daysAfter.value);

  if (!name) return;
  if (!Number.isInteger(days) || days < 0) {
    alert("Days must be a whole number 0 or higher.");
    return;
  }

  const items = loadItems();
  const id = editId.value || uuid();

  const item = {
    id,
    name,
    days,
    createdAt: new Date().toISOString()
  };

  saveItems(upsertItem(items, item));
  render(loadItems());
  resetForm();
});

clearBtn.addEventListener("click", resetForm);

searchInput.addEventListener("input", () => {
  render(loadItems());
});

cardsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const items = loadItems();
  const item = items.find(x => x.id === id);
  if (!item) return;

  if (action === "edit") {
    editId.value = item.id;
    productName.value = item.name;
    daysAfter.value = String(item.days);
    el("saveBtn").textContent = "Update";
    productName.focus();
  }

  if (action === "del") {
    const ok = confirm(`Delete "${item.name}"?`);
    if (!ok) return;
    const next = items.filter(x => x.id !== id);
    saveItems(next);
    render(next);
    resetForm();
  }
});

exportBtn.addEventListener("click", () => {
  const items = loadItems();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pantry-items.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");

    const cleaned = parsed.map(x => ({
      id: typeof x.id === "string" ? x.id : uuid(),
      name: String(x.name ?? "").trim(),
      days: Number.isFinite(Number(x.days)) ? Number(x.days) : 0,
      createdAt: x.createdAt ? String(x.createdAt) : new Date().toISOString()
    })).filter(x => x.name.length > 0);

    saveItems(cleaned);
    render(cleaned);
    resetForm();
    alert("Import successful.");
  } catch (err) {
    alert("Import failed: " + (err?.message ?? "Invalid file"));
  } finally {
    importFile.value = "";
  }
});

// Init
(async function init() {
  setTodayLabel();
  await ensurePrefill();
  render(loadItems());
})();
