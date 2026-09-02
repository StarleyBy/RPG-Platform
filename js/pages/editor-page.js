function showCategoryView(schemaId, editEntry) {
  const schema = STATE.schemasById[schemaId];
  if (!schema) { toast("Схема не найдена: " + schemaId, true); return; }
  STATE.currentSchemaId = schemaId;
  const body = document.getElementById("categoryBody");
  body.innerHTML = "";
  body.appendChild(el("div", { class: "cat-header" }, [el("div", {}, [el("h2", { text: `${schema.icon||"📦"} ${schema.label}` }), schema.description ? el("p", { class: "desc", text: schema.description }) : null])]));
  const items = STATE.manifestIndex.filter(m => m.data.type === schemaId);
  if (!editEntry) {
    const listHost = el("div", { class: "item-list" });
    if (items.length === 0) listHost.appendChild(el("p", { class: "desc", text: "Пока нет ни одного манифеста этого типа." }));
    for (const m of items) {
      listHost.appendChild(el("div", { class: "item-row", style: `border-left:3px solid ${schema.color}`, onclick: () => showCategoryView(schemaId, m) }, [
        el("span", { text: m.data.name || m.data.id }), el("span", { class: "iid", text: m.data.id }),
        el("button", { class: "danger del", text: "🗑", onclick: (e) => { e.stopPropagation(); deleteManifest(m); } })
      ]));
    }
    body.appendChild(listHost);
  }
  const newBtn = el("button", { class: "primary", text: editEntry ? "← К списку" : "➕ Новый манифест", onclick: () => editEntry ? showCategoryView(schemaId) : showCategoryView(schemaId, { data: {}, path: null }) });
  body.appendChild(newBtn);
  if (editEntry) body.appendChild(renderForm(schema, editEntry));
}

/**
 * controlsByKey — плоский реестр "ключ поля -> уже построенный контрол",
 * собирается по ходу рендера ВСЕХ полей формы (базовых и секционных) и
 * передаётся дальше как context в buildField. Нужен для полей с
 * depends_on (см. js/fields/dependent-fields.js) — они читают текущее
 * значение поля-источника через этот реестр, а после того как форма
 * целиком построена, здесь же навешивается подписка: смена значения
 * поля-источника (например 'Вид растения') пересчитывает список у
 * зависимых от него полей ('Собираемая часть', 'Биомы', 'Сезоны').
 */
function renderForm(schema, entry) {
  const data = entry.data || {};
  const fieldGetters = {}; const sectionGetters = [];
  const controlsByKey = {}; const allFieldDefs = [];
  const context = { controlsByKey };

  const panel = el("div", { class: "form-panel", style: `--dot:${schema.color}` });
  const baseGrid = el("div", { class: "form-grid" });
  let idField = null;
  for (const fdef of schema.base_fields) {
    if (fdef.key === "id") {
      idField = buildIdFieldWithConflictCheck(fdef, data.id, entry.path);
      fieldGetters.id = idField.get; controlsByKey.id = idField;
      baseGrid.appendChild(idField.wrapEl);
      continue;
    }
    const f = buildField(fdef, STATE.vocab, data[fdef.key], context);
    fieldGetters[fdef.key] = f.get; controlsByKey[fdef.key] = f; allFieldDefs.push(fdef);
    baseGrid.appendChild(f.wrapEl);
  }
  panel.appendChild(baseGrid);

  for (const section of schema.sections) {
    const secData = data[section.key] || {};
    const enabledDefault = secData.enabled ?? section.default_on ?? false;
    const checkbox = el("input", { type: "checkbox" }); checkbox.checked = enabledDefault;
    const sectionBody = el("div", { class: "form-panel", style: `display:${enabledDefault?"":"none"};--dot:${section.color||schema.color}` });
    if (section.note) sectionBody.appendChild(el("div", { class: "section-note", text: section.note }));
    const secGrid = el("div", { class: "form-grid" }); const secFieldGetters = {};
    for (const fdef of section.fields) {
      const f = buildField(fdef, STATE.vocab, secData[fdef.key], context);
      secFieldGetters[fdef.key] = f.get; controlsByKey[fdef.key] = f; allFieldDefs.push(fdef);
      secGrid.appendChild(f.wrapEl);
    }
    sectionBody.appendChild(secGrid);
    checkbox.addEventListener("change", () => { sectionBody.style.display = checkbox.checked ? "" : "none"; });
    panel.appendChild(el("label", { class: "section-toggle" }, [checkbox, document.createTextNode(section.toggle_label || section.key)]));
    panel.appendChild(sectionBody);
    sectionGetters.push({ key: section.key, enabled: () => checkbox.checked, fields: secFieldGetters });
  }

  _wireDependentFields_(allFieldDefs, controlsByKey);

  const statusMsg = el("div", { class: "status-msg", id: "formStatus" });
  const saveBtn = el("button", { class: "primary", text: "💾 Сохранить манифест", onclick: () => saveManifest(schema, entry, fieldGetters, sectionGetters, statusMsg, idField) });
  const actions = el("div", { class: "form-actions" }, [saveBtn]);
  if (entry.path) actions.appendChild(el("button", { class: "danger", text: "🗑 Удалить", onclick: () => deleteManifest(entry) }));
  panel.appendChild(actions); panel.appendChild(statusMsg);
  return panel;
}

function _wireDependentFields_(allFieldDefs, controlsByKey) {
  for (const fdef of allFieldDefs) {
    if (!fdef.depends_on) continue;
    const depControl = controlsByKey[fdef.depends_on];
    const thisControl = controlsByKey[fdef.key];
    if (!depControl || !thisControl || !thisControl.refreshFromDependency) continue;
    if (depControl.selectEl) {
      depControl.selectEl.addEventListener("change", () => thisControl.refreshFromDependency());
    }
  }
}

function buildIdFieldWithConflictCheck(fdef, val, currentPath) {
  const input = el("input", { type: "text", value: val ?? fdef.default ?? "" });
  const msg = el("div", { class: "field-conflict-msg" });
  function check() {
    const idVal = input.value.trim();
    if (!idVal) { msg.textContent = ""; input.classList.remove("conflict"); return; }
    const conflict = findIdConflict(idVal, currentPath);
    if (conflict) { input.classList.add("conflict"); const cs = STATE.schemasById[conflict.data.type]; msg.textContent = `⚠️ ID уже используется: "${conflict.data.name||conflict.data.id}" (${cs?cs.label:conflict.data.type})`; msg.classList.remove("ok"); }
    else { input.classList.remove("conflict"); msg.textContent = "✓ ID свободен"; msg.classList.add("ok"); }
  }
  input.addEventListener("input", check); check();
  const wrap = el("div", { class: "field-block" }, [el("label", { text: fdef.label||fdef.key }), input, msg]);
  return { wrapEl: wrap, get: () => input.value.trim(), hasConflict: () => !!findIdConflict(input.value.trim(), currentPath) };
}

async function saveManifest(schema, entry, fieldGetters, sectionGetters, statusMsg, idField) {
  const out = { type: schema.id, group: schema.group };
  for (const key in fieldGetters) out[key] = fieldGetters[key]();
  const idVal = String(out.id||"").trim();
  if (!idVal) { statusMsg.textContent = "⚠️ Укажи ID перед сохранением."; statusMsg.className = "status-msg err"; return; }
  out.id = idVal;
  if (idField && idField.hasConflict()) { statusMsg.textContent = "❌ Этот ID уже занят другим манифестом."; statusMsg.className = "status-msg err"; return; }
  for (const sec of sectionGetters) { const enabled = sec.enabled(); const secOut = { enabled }; if (enabled) for (const key in sec.fields) secOut[key] = sec.fields[key](); out[sec.key] = secOut; }
  const path = resolveSavePath(schema.save_path, idVal);
  try {
    await STATE.adapter.writeJson(path, out);
    const existingIdx = STATE.manifestIndex.findIndex(m => m.path === path);
    if (existingIdx >= 0) STATE.manifestIndex[existingIdx] = { path, data: out }; else STATE.manifestIndex.push({ path, data: out });
    statusMsg.textContent = "✅ Сохранено: " + path; statusMsg.className = "status-msg";
    entry.path = path; entry.data = out;
    populateCategorySelect(); document.getElementById("categorySelect").value = schema.id;
  } catch (e) { statusMsg.textContent = "❌ " + e.message; statusMsg.className = "status-msg err"; }
}

async function deleteManifest(entry) {
  if (!entry.path) return;
  if (!confirm("Удалить манифест '" + (entry.data.name||entry.data.id) + "'?")) return;
  try {
    await STATE.adapter.deleteJson(entry.path);
    STATE.manifestIndex = STATE.manifestIndex.filter(m => m.path !== entry.path);
    populateCategorySelect();
    if (STATE.currentPage === "editor" && STATE.currentSchemaId) { document.getElementById("categorySelect").value = STATE.currentSchemaId; showCategoryView(STATE.currentSchemaId); }
  } catch (e) { toast("Ошибка удаления: " + e.message, true); }
}
