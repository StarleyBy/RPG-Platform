/**
 * ability_list — "бесконечный" конструктор способностей/эффектов.
 * Выпадающие списки показывают перевод глагола/цели/области/модификатора/
 * условия, get() всегда возвращает английские токены.
 */
function comboWithCustom(options) {
  const select = el("select");
  for (const o of sortByRuLabel(options.filter(x => x !== CUSTOM_MARK))) {
    select.appendChild(el("option", { value: o, text: ruLabel(o) }));
  }
  select.appendChild(el("option", { value: CUSTOM_MARK, text: "— свой вариант —" }));
  const customInput = el("input", { type: "text", placeholder: "свой вариант...", style: "display:none" });
  select.addEventListener("change", () => {
    customInput.style.display = select.value === CUSTOM_MARK ? "" : "none";
  });
  return {
    select, customInput,
    get: () => select.value === CUSTOM_MARK ? customInput.value : select.value,
    set: (v) => {
      if (options.includes(v)) { select.value = v; customInput.style.display = "none"; }
      else { select.value = CUSTOM_MARK; customInput.value = v || ""; customInput.style.display = ""; }
    }
  };
}

function buildAbilityRow(vocab, rowData) {
  const verb = comboWithCustom(vocab.ability_verbs || []);
  const target = comboWithCustom(vocab.ability_targets || []);
  const scope = comboWithCustom(vocab.ability_scopes || ["self"]);
  const modifier = comboWithCustom(vocab.ability_modifiers || ["flat"]);
  const value = el("input", { type: "text", placeholder: "2 / 15% / true / имя" });
  const formula = el("input", { type: "text", placeholder: "0.001 * PLAYER_LEVEL" });
  const condition = comboWithCustom(vocab.ability_conditions || ["none"]);
  const note = el("input", { type: "text", placeholder: "заметка" });
  const rmBtn = el("button", { class: "rm", text: "✕" });

  const row = el("div", { class: "ability-row" }, [
    verb.select, verb.customInput, target.select, target.customInput,
    scope.select, modifier.select, value, formula, condition.select, note, rmBtn
  ]);

  if (rowData) {
    verb.set(rowData.verb); target.set(rowData.target); scope.set(rowData.scope || "self");
    modifier.set(rowData.modifier_type || "flat"); value.value = rowData.value ?? "";
    formula.value = rowData.formula ?? ""; condition.set(rowData.condition || "none");
    note.value = rowData.note ?? "";
  }

  return {
    el: row,
    remove: (cb) => rmBtn.addEventListener("click", cb),
    get: () => ({
      verb: verb.get(), target: target.get(), scope: scope.get(),
      modifier_type: modifier.get(), value: value.value, formula: formula.value,
      condition: condition.get(), note: note.value
    })
  };
}

function buildAbilityListField(fdef, vocab, val) {
  const rows = [];
  const rowsHost = el("div", { class: "ability-list" });
  const addBtn = el("button", { class: "add-ability-btn", text: "➕ Добавить способность / эффект" });

  function addRow(data) {
    const row = buildAbilityRow(vocab, data);
    row.remove(() => { rowsHost.removeChild(row.el); rows.splice(rows.indexOf(row), 1); });
    rowsHost.appendChild(row.el);
    rows.push(row);
  }
  addBtn.addEventListener("click", () => addRow(null));
  for (const r of (val || fdef.default || [])) addRow(r);

  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [
    el("label", { text: fdef.label || fdef.key }), rowsHost, addBtn
  ]);
  return {
    wrapEl: wrap,
    get: () => rows.map(r => r.get()),
    set: (v) => { rowsHost.innerHTML = ""; rows.length = 0; for (const r of (v || [])) addRow(r); }
  };
}

/* ---------------------------------------------------------------------- */
/* Category view: список существующих манифестов + форма создания/правки  */
/* ---------------------------------------------------------------------- */

