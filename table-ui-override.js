// Table UI Override (for the table-based index.html)
// Drop this file into the app folder
// Keep: <script src="app.js"></script> then <script src="table-ui-override.js"></script>

(function () {
  // app.js defines these in the global scope; we rely on them:
  // - computeLabelDate(days)
  // - formatMdyNoLeadingZeros(date)
  // - escapeHtml(str)

  if (typeof render !== "function") return;

  window.render = function (items) {
    const searchInput = document.getElementById("searchInput");
    const q = (searchInput?.value || "").trim().toLowerCase();

    const tbody = document.getElementById("itemsTbody");
    if (!tbody) return;

    const filtered = q
      ? items.filter(it =>
          it.name.toLowerCase().includes(q) ||
          String(it.days).includes(q)
        )
      : items;

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4" style="color:#a9b0bd;">No items found.</td>`;
      tbody.appendChild(tr);
      return;
    }

    filtered
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(it => {
        const labelDate = computeLabelDate(it.days);
        const expires = formatMdyNoLeadingZeros(labelDate);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(it.name)}</td>
          <td class="num">${it.days}</td>
          <td>${expires}</td>
          <td class="actions">
            <button class="actionBtn" data-action="edit" data-id="${it.id}">Edit</button>
            <button class="actionBtn" data-action="del" data-id="${it.id}">Del</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  };
})();