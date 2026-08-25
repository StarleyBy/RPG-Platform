/**
 * Поля, которые НЕ читают статичный словарь, а тянут варианты из живого
 * состояния проекта — STATE.manifestIndex (другие уже созданные манифесты)
 * или STATE.vocab (общие словари, но с мультивыбором вместо одиночного).
 *
 * Это прямой ответ на проблему "вручную ввели класс 'воинн' — предмет
 * никто не может использовать": там, где раньше было текстовое поле
 * (class_restrictions и т.п.), теперь чекбокс-список уже существующих
 * манифестов нужного типа. Опечатка физически невозможна — либо класс
 * уже создан и выбирается, либо его ещё нет и сначала нужно создать его
 * манифест (👉 подсказка "Пока нет ни одного..." прямо в списке).
 *
 * "Живость": список не замораживается на момент открытия формы — кнопка
 * "🔄 Обновить список" внутри поля дозагружает STATE.manifestIndex заново
 * и перестраивает варианты, не теряя остальные значения формы.
 */

// --- общий чекбокс-пикер с фильтром (для >12 вариантов) -------------------

function buildCheckboxPicker(groups, initialIds) {
  const box = el("div", { class: "multiref-box" });
  let filterInput = null;
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  if (totalItems > 12) {
    filterInput = el("input", { class: "multiref-filter", type: "text", placeholder: "Фильтр по названию или ID..." });
    box.appendChild(filterInput);
  }
  const listEl = el("div", { class: "multiref-list" });
  box.appendChild(listEl);

  let currentGroups = groups;
  const selected = new Set(initialIds || []);

  function renderList(filterText) {
    listEl.innerHTML = "";
    const needle = (filterText || "").toLowerCase();
    let anyVisible = false;
    for (const g of currentGroups) {
      const visibleItems = g.items.filter(it =>
        !needle || it.display.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle));
      if (!visibleItems.length) continue;
      anyVisible = true;
      if (currentGroups.length > 1 && g.label) {
        listEl.appendChild(el("div", { class: "multiref-group-label", text: g.label }));
      }
      for (const it of visibleItems) {
        const cb = el("input", { type: "checkbox" });
        cb.checked = selected.has(it.id);
        cb.addEventListener("change", () => {
          if (cb.checked) selected.add(it.id); else selected.delete(it.id);
        });
        listEl.appendChild(el("label", { class: "multiref-item" }, [
          cb, el("span", { text: it.display }), el("span", { class: "mi-id", text: it.id })
        ]));
      }
    }
    if (!anyVisible) {
      const totalNow = currentGroups.reduce((n, g) => n + g.items.length, 0);
      listEl.appendChild(el("div", {
        class: "multiref-empty",
        text: totalNow === 0
          ? "Пока нет ни одного подходящего манифеста — сначала создай хотя бы один в соответствующей категории."
          : "Ничего не найдено по фильтру."
      }));
    }
  }
  renderList("");
  if (filterInput) filterInput.addEventListener("input", () => renderList(filterInput.value));

  return {
    el: box,
    get: () => Array.from(selected),
    setSelected: (ids) => { selected.clear(); (ids || []).forEach(id => selected.add(id)); renderList(filterInput ? filterInput.value : ""); },
    setGroups: (newGroups) => { currentGroups = newGroups; renderList(filterInput ? filterInput.value : ""); }
  };
}

// --- vocab_multiselect: мультивыбор из статичного словаря ------------------

function buildVocabMultiselectField(fdef, vocab, val) {
  const options = optionsForField(fdef, vocab);
  const items = options.map(o => ({ id: o, display: ruLabel(o) }));
  const picker = buildCheckboxPicker([{ label: null, items }], val || fdef.default || []);
  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [
    el("label", { text: fdef.label || fdef.key }), picker.el
  ]);
  return { wrapEl: wrap, get: picker.get, set: (v) => picker.setSelected(v) };
}

// --- manifest_multiref: мультивыбор из ДРУГИХ манифестов, живьём -----------

function _refTypesOf_(fdef) {
  return Array.isArray(fdef.ref_type) ? fdef.ref_type : [fdef.ref_type];
}

function _computeManifestGroups_(refTypes) {
  return refTypes.map(rt => {
    const schema = STATE.schemasById[rt];
    const items = STATE.manifestIndex.filter(m => m.data.type === rt)
      .map(m => ({ id: m.data.id, display: m.data.name || m.data.id }))
      .sort((a, b) => a.display.localeCompare(b.display));
    return { label: refTypes.length > 1 ? (schema ? schema.icon + " " + schema.label : rt) : null, items };
  });
}

function buildManifestMultirefField(fdef, val, embedded) {
  const refTypes = _refTypesOf_(fdef);
  const picker = buildCheckboxPicker(_computeManifestGroups_(refTypes), val || fdef.default || []);

  const countLabel = el("span", { class: "multiref-count" });
  function updateCount() {
    const n = _computeManifestGroups_(refTypes).reduce((s, g) => s + g.items.length, 0);
    countLabel.textContent = n + " доступно";
  }
  updateCount();

  const refreshBtn = el("button", { text: "🔄 Обновить список" });
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = "⏳ Обновляю...";
    await loadAllManifests(); // полный пересбор STATE.manifestIndex с диска/GitHub
    picker.setGroups(_computeManifestGroups_(refTypes));
    updateCount();
    refreshBtn.disabled = false; refreshBtn.textContent = "🔄 Обновить список";
  });

  const wrapStyle = embedded ? "" : "grid-column:1/-1";
  const wrap = el("div", { class: "field-block", style: wrapStyle }, [
    el("label", { text: fdef.label || fdef.key }),
    picker.el,
    el("div", { class: "multiref-refresh" }, [countLabel, refreshBtn])
  ]);
  return { wrapEl: wrap, get: picker.get, set: (v) => picker.setSelected(v) };
}

// --- manifest_ref: одиночный выбор из ДРУГИХ манифестов, живьём ------------

function buildManifestRefField(fdef, val) {
  const refTypes = _refTypesOf_(fdef);
  const select = el("select");

  function render(keepValue) {
    const prev = keepValue !== undefined ? keepValue : select.value;
    select.innerHTML = "";
    select.appendChild(el("option", { value: "", text: "— не выбрано —" }));
    for (const g of _computeManifestGroups_(refTypes)) {
      for (const it of g.items) {
        select.appendChild(el("option", { value: it.id, text: it.display + "  (" + it.id + ")" }));
      }
    }
    select.value = prev || "";
  }
  render(val || "");

  const refreshBtn = el("button", { text: "🔄" });
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    await loadAllManifests();
    render();
    refreshBtn.disabled = false;
  });

  const row = el("div", { style: "display:flex;gap:6px;align-items:center" }, [select, refreshBtn]);
  const wrap = el("div", { class: "field-block" }, [el("label", { text: fdef.label || fdef.key }), row]);
  return { wrapEl: wrap, get: () => select.value, set: (v) => { select.value = v || ""; } };
}
