/**
 * Страница "Просмотр и база данных" — сводка по типам, полнотекстовый
 * поиск, фильтры, сортировка. Клик по строке открывает объект в Редакторе.
 */
let dbFilterType = "";
let dbFilterGroup = "";
let dbFilterText = "";
let dbSortKey = "name";
let dbSortDir = 1;

function renderDatabasePage() {
  const page = document.getElementById("databasePage");
  page.innerHTML = "";

  page.appendChild(el("div", { class: "cat-header" }, [
    el("div", {}, [
      el("h2", { text: "📊 Просмотр и база данных" }),
      el("p", { class: "desc", text: `Всего манифестов: ${STATE.manifestIndex.length}. Клик по карточке — фильтр по типу, клик по строке — открыть на редактирование.` })
    ])
  ]));

  const counts = {};
  for (const m of STATE.manifestIndex) {
    const t = m.data.type || "unknown";
    counts[t] = (counts[t] || 0) + 1;
  }
  const statsGrid = el("div", { id: "statsGrid" });
  const sortedTypes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  for (const t of sortedTypes) {
    const schema = STATE.schemasById[t];
    const chip = el("div", {
      class: "stat-chip", style: `border-color:${schema ? schema.color : "#444"}`,
      onclick: () => { dbFilterType = (dbFilterType === t ? "" : t); renderDatabasePage(); }
    }, [
      el("span", { class: "n", text: String(counts[t]) }),
      el("span", { text: (schema ? schema.icon + " " + schema.label : t) })
    ]);
    if (dbFilterType === t) chip.style.outline = "2px solid " + (schema ? schema.color : "#fff");
    statsGrid.appendChild(chip);
  }
  page.appendChild(statsGrid);

  const searchRow = el("div", { class: "search-row" });
  const textInput = el("input", {
    type: "text", placeholder: "Поиск по ID, названию, подтипу, тегам...",
    value: dbFilterText,
    oninput: (e) => { dbFilterText = e.target.value; renderTable(); }
  });
  const typeSelect = el("select", {
    onchange: (e) => { dbFilterType = e.target.value; renderDatabasePage(); }
  });
  typeSelect.appendChild(el("option", { value: "", text: "Все типы" }));
  for (const schema of STATE.schemas) {
    const opt = el("option", { value: schema.id, text: schema.label });
    if (schema.id === dbFilterType) opt.selected = true;
    typeSelect.appendChild(opt);
  }
  const groupSelect = el("select", {
    onchange: (e) => { dbFilterGroup = e.target.value; renderTable(); }
  });
  groupSelect.appendChild(el("option", { value: "", text: "Все группы" }));
  for (const g of GROUP_ORDER) {
    const opt = el("option", { value: g, text: GROUP_LABELS[g] });
    if (g === dbFilterGroup) opt.selected = true;
    groupSelect.appendChild(opt);
  }
  searchRow.appendChild(textInput);
  searchRow.appendChild(typeSelect);
  searchRow.appendChild(groupSelect);
  page.appendChild(searchRow);

  const tableHost = el("div", { id: "tableHost" });
  page.appendChild(tableHost);

  function matches(m) {
    if (dbFilterType && m.data.type !== dbFilterType) return false;
    if (dbFilterGroup && m.data.group !== dbFilterGroup) return false;
    if (dbFilterText) {
      const needle = dbFilterText.toLowerCase();
      const haystack = JSON.stringify(m.data).toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }

  function renderTable() {
    const rows = STATE.manifestIndex.filter(matches);
    rows.sort((a, b) => {
      const av = String(a.data[dbSortKey] ?? "");
      const bv = String(b.data[dbSortKey] ?? "");
      return av.localeCompare(bv) * dbSortDir;
    });

    tableHost.innerHTML = "";
    tableHost.appendChild(el("p", { class: "desc", text: `Найдено: ${rows.length}` }));

    const table = el("table", { class: "data-table" });
    const thead = el("thead");
    const headRow = el("tr");
    const columns = [["name","Название"],["id","ID"],["type","Тип"],["rarity","Редкость"],["subtype","Подтип"]];
    for (const [key, label] of columns) {
      headRow.appendChild(el("th", {
        text: label + (dbSortKey === key ? (dbSortDir === 1 ? " ▲" : " ▼") : ""),
        onclick: () => {
          if (dbSortKey === key) dbSortDir *= -1; else { dbSortKey = key; dbSortDir = 1; }
          renderTable();
        }
      }));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const m of rows) {
      const schema = STATE.schemasById[m.data.type];
      const subtypeRaw = m.data.subtype || m.data.node_type || m.data.settlement_type || "";
      const tr = el("tr", { onclick: () => openManifestInEditor(m) }, [
        el("td", { text: m.data.name || "—" }),
        el("td", { text: m.data.id || "—", style: "font-family:var(--mono);color:var(--text-dim)" }),
        el("td", {}, [el("span", {
          class: "type-tag", text: schema ? schema.icon + " " + schema.label : (m.data.type || "?"),
          style: `border-color:${schema ? schema.color : "#444"}`
        })]),
        el("td", { text: m.data.rarity ? ruLabel(m.data.rarity) : "—" }),
        el("td", { text: subtypeRaw ? ruLabel(subtypeRaw) : "—" })
      ]);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableHost.appendChild(table);
  }

  renderTable();
}

function openManifestInEditor(manifestEntry) {
  const schema = STATE.schemasById[manifestEntry.data.type];
  if (!schema) { toast("Неизвестная схема для этого манифеста: " + manifestEntry.data.type, true); return; }
  switchPage("editor");
  document.getElementById("categorySelect").value = schema.id;
  showCategoryView(schema.id, manifestEntry);
}

/* ---------------------------------------------------------------------- */
/* Field factory — все опции отображаются по-русски (ruLabel), но         */
/* хранится и попадает в JSON всегда английское машинное значение.        */
/* ---------------------------------------------------------------------- */

