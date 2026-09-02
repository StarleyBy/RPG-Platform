function buildCheckboxPicker(groups, initialIds, opts) {
  opts = opts || {};
  const box = el("div", { class: "multiref-box" });
  let filterInput = null;
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  if (totalItems > 12) { filterInput = el("input", { class: "multiref-filter", type: "text", placeholder: "Фильтр..." }); box.appendChild(filterInput); }
  const listEl = el("div", { class: "multiref-list" }); box.appendChild(listEl);
  let currentGroups = groups;
  const selected = new Set(initialIds || []);
  const customItems = [];
  if (opts.allowCustomAdd) {
    const knownIds = new Set();
    for (const g of groups) for (const it of g.items) knownIds.add(it.id);
    for (const id of selected) if (!knownIds.has(id)) customItems.push({ id, display: ruLabel(id) });
  }
  function allGroupsForRender() { if (!customItems.length) return currentGroups; return [{ label: "✎ Свои варианты", items: customItems }].concat(currentGroups); }
  function renderList(filterText) {
    listEl.innerHTML = "";
    const needle = (filterText||"").toLowerCase(); let anyVisible = false;
    const groupsToRender = allGroupsForRender();
    for (const g of groupsToRender) {
      const visibleItems = g.items.filter(it => !needle || it.display.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle));
      if (!visibleItems.length) continue; anyVisible = true;
      if (groupsToRender.length > 1 && g.label) listEl.appendChild(el("div", { class: "multiref-group-label", text: g.label }));
      for (const it of visibleItems) {
        const cb = el("input", { type: "checkbox" }); cb.checked = selected.has(it.id);
        cb.addEventListener("change", () => { if (cb.checked) selected.add(it.id); else selected.delete(it.id); });
        listEl.appendChild(el("label", { class: "multiref-item" }, [cb, el("span", { text: it.display }), el("span", { class: "mi-id", text: it.id })]));
      }
    }
    if (!anyVisible) {
      const totalNow = groupsToRender.reduce((n,g)=>n+g.items.length,0);
      listEl.appendChild(el("div", { class: "multiref-empty", text: totalNow===0 ? (opts.emptyMessage||"Пока нет ни одного подходящего манифеста.") : "Ничего не найдено." }));
    }
  }
  renderList("");
  if (filterInput) filterInput.addEventListener("input", () => renderList(filterInput.value));
  if (opts.allowCustomAdd) {
    const addInput = el("input", { class: "multiref-filter", type: "text", placeholder: "+ добавить своё значение и нажать Enter..." });
    addInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return; e.preventDefault();
      const raw = addInput.value.trim(); if (!raw) return;
      if (!customItems.some(it=>it.id===raw)) customItems.push({ id: raw, display: raw });
      selected.add(raw); addInput.value = ""; renderList(filterInput?filterInput.value:"");
    });
    box.appendChild(addInput);
  }
  return { el: box, get: () => Array.from(selected),
    setSelected: (ids) => { selected.clear(); (ids||[]).forEach(id=>selected.add(id)); renderList(filterInput?filterInput.value:""); },
    setGroups: (newGroups) => { currentGroups = newGroups; renderList(filterInput?filterInput.value:""); } };
}
function buildVocabMultiselectField(fdef, vocab, val) {
  const options = sortByRuLabel(optionsForField(fdef, vocab));
  const items = options.map(o => ({ id: o, display: ruLabel(o) }));
  const picker = buildCheckboxPicker([{ label: null, items }], val || fdef.default || [], { allowCustomAdd: true, emptyMessage: "В словаре пока нет вариантов." });
  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [el("label", { text: fdef.label||fdef.key }), picker.el]);
  return { wrapEl: wrap, get: picker.get, set: (v) => picker.setSelected(v) };
}
function _refTypesOf_(fdef) { return Array.isArray(fdef.ref_type) ? fdef.ref_type : [fdef.ref_type]; }
function _computeManifestGroups_(refTypes) {
  return refTypes.map(rt => {
    const schema = STATE.schemasById[rt];
    const items = STATE.manifestIndex.filter(m => m.data.type === rt).map(m => ({ id: m.data.id, display: m.data.name || m.data.id })).sort((a,b)=>a.display.localeCompare(b.display));
    return { label: refTypes.length>1 ? (schema?schema.icon+" "+schema.label:rt) : null, items };
  });
}
function buildManifestMultirefField(fdef, val, embedded) {
  const refTypes = _refTypesOf_(fdef);
  const picker = buildCheckboxPicker(_computeManifestGroups_(refTypes), val || fdef.default || []);
  const countLabel = el("span", { class: "multiref-count" });
  function updateCount() { const n = _computeManifestGroups_(refTypes).reduce((s,g)=>s+g.items.length,0); countLabel.textContent = n + " доступно"; }
  updateCount();
  const refreshBtn = el("button", { text: "🔄 Обновить список" });
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = "⏳ Обновляю...";
    await loadAllManifests(); picker.setGroups(_computeManifestGroups_(refTypes)); updateCount();
    refreshBtn.disabled = false; refreshBtn.textContent = "🔄 Обновить список";
  });
  const wrapStyle = embedded ? "" : "grid-column:1/-1";
  const wrap = el("div", { class: "field-block", style: wrapStyle }, [el("label", { text: fdef.label||fdef.key }), picker.el, el("div", { class: "multiref-refresh" }, [countLabel, refreshBtn])]);
  return { wrapEl: wrap, get: picker.get, set: (v) => picker.setSelected(v) };
}

// manifest_ref: одиночный выбор из ДРУГИХ манифестов, живьём. allow_custom=true
// (например material_raw.source: не у каждого материала есть манифест-первоисточник —
// "crafted"/"quest" не всегда сводится к конкретному манифесту) добавляет
// "— свой вариант —" по тому же принципу, что и у enum-полей.
// selectEl отдаётся наружу намеренно — это то, за что "цепляются" зависимые поля
// (dependent_enum/dependent_multiselect), чтобы среагировать на смену значения.
function buildManifestRefField(fdef, val) {
  const refTypes = _refTypesOf_(fdef);
  const select = el("select");
  let customInput = null;

  function render(keepValue) {
    const prev = keepValue !== undefined ? keepValue : select.value;
    select.innerHTML = ""; select.appendChild(el("option", { value: "", text: "— не выбрано —" }));
    for (const g of _computeManifestGroups_(refTypes)) for (const it of g.items) select.appendChild(el("option", { value: it.id, text: it.display + "  (" + it.id + ")" }));
    if (fdef.allow_custom) select.appendChild(el("option", { value: CUSTOM_MARK, text: "— свой вариант —" }));
    const allIds = Array.from(select.options).map(o => o.value);
    if (allIds.includes(prev)) { select.value = prev; if (customInput) customInput.style.display = "none"; }
    else if (fdef.allow_custom && prev) { select.value = CUSTOM_MARK; if (customInput) { customInput.value = prev; customInput.style.display = ""; } }
    else { select.value = ""; }
  }

  if (fdef.allow_custom) {
    customInput = el("input", { type: "text", placeholder: "свой вариант...", style: "margin-top:6px;display:none" });
    select.addEventListener("change", () => { customInput.style.display = select.value === CUSTOM_MARK ? "" : "none"; });
  }
  render(val || "");

  const refreshBtn = el("button", { text: "🔄" });
  refreshBtn.addEventListener("click", async () => { refreshBtn.disabled = true; await loadAllManifests(); render(); refreshBtn.disabled = false; });
  const row = el("div", { style: "display:flex;gap:6px;align-items:center" }, [select, refreshBtn]);
  const children = [el("label", { text: fdef.label||fdef.key }), row];
  if (customInput) children.push(customInput);
  const wrap = el("div", { class: "field-block" }, children);

  return {
    wrapEl: wrap,
    selectEl: select,
    get: () => (fdef.allow_custom && select.value === CUSTOM_MARK) ? customInput.value : select.value,
    set: (v) => { render(v || ""); }
  };
}
