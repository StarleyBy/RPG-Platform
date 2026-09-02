/**
 * Поля, чей список вариантов зависит от значения ДРУГОГО поля той же формы
 * (обычно manifest_ref). Пример: у "Растения" поле "Собираемая часть"
 * должно показывать только те части, что реально указаны у выбранного
 * "Вида растения" (growth.harvestable_parts), а не полный словарь.
 *
 * depends_on   — ключ поля-источника (должен уже существовать в
 *                controlsByKey и отдавать selectEl — на практике это
 *                всегда manifest_ref/manifest_multiref).
 * source_path  — путь внутри манифеста, на который ссылается depends_on
 *                (например "growth.harvestable_parts"), точки — вложенность.
 * fallback_options_ref — словарь на случай, если depends_on ещё не
 *                выбран или у выбранного манифеста там пусто — чтобы поле
 *                не блокировало работу, а просто временно показывало всё.
 *
 * Связывает поля воедино editor-page.js (см. _wireDependentFields_) —
 * этот файл сам по себе не подписывается на события, только предоставляет
 * .refreshFromDependency().
 */

function resolveDependentSourceArray(fdef, controlsByKey) {
  const depControl = controlsByKey[fdef.depends_on];
  const depValue = depControl ? depControl.get() : "";
  if (!depValue) return null;
  const manifest = STATE.manifestIndex.find(m => m.data.id === depValue);
  if (!manifest) return null;
  let node = manifest.data;
  for (const part of fdef.source_path.split(".")) {
    node = node ? node[part] : undefined;
  }
  return Array.isArray(node) && node.length ? node : null;
}

function _dependencyHintText_(fdef, controlsByKey, count) {
  const depControl = controlsByKey[fdef.depends_on];
  const depValue = depControl ? depControl.get() : "";
  if (!depValue) return "Сначала выбери значение поля выше — список пока полный (не сужен).";
  const manifest = STATE.manifestIndex.find(m => m.data.id === depValue);
  const name = manifest ? (manifest.data.name || manifest.data.id) : depValue;
  if (count === null) return `У "${name}" не указано ничего по пути "${fdef.source_path}" — показан полный список.`;
  return `Список сужен по данным "${name}" (${count}).`;
}

function buildDependentEnumField(fdef, vocab, val, controlsByKey) {
  const select = el("select");
  const hint = el("div", { class: "hint" });

  function computeOptions() {
    const dep = resolveDependentSourceArray(fdef, controlsByKey);
    return dep || optionsForField({ options_ref: fdef.fallback_options_ref }, vocab);
  }
  function render(keepValue) {
    const prev = keepValue !== undefined ? keepValue : select.value;
    const dep = resolveDependentSourceArray(fdef, controlsByKey);
    const opts = sortByRuLabel(dep || optionsForField({ options_ref: fdef.fallback_options_ref }, vocab));
    select.innerHTML = "";
    for (const o of opts) select.appendChild(el("option", { value: o, text: ruLabel(o) }));
    select.value = opts.includes(prev) ? prev : (opts[0] || "");
    hint.textContent = _dependencyHintText_(fdef, controlsByKey, dep ? dep.length : null);
  }
  render(val || "");

  const wrap = el("div", { class: "field-block" }, [el("label", { text: fdef.label || fdef.key }), select, hint]);
  return {
    wrapEl: wrap,
    get: () => select.value,
    set: (v) => render(v),
    refreshFromDependency: () => render()
  };
}

function buildDependentMultiselectField(fdef, vocab, val, controlsByKey) {
  let picker = null;
  const hint = el("div", { class: "hint" });
  const bodyHost = el("div");

  function currentOptionsItems() {
    const dep = resolveDependentSourceArray(fdef, controlsByKey);
    const source = dep || optionsForField({ options_ref: fdef.fallback_options_ref }, vocab);
    return { dep, items: sortByRuLabel(source).map(o => ({ id: o, display: ruLabel(o) })) };
  }

  function rebuild(keepSelected) {
    const { dep, items } = currentOptionsItems();
    const selectedNow = keepSelected !== undefined ? keepSelected : (picker ? picker.get() : (val || fdef.default || []));
    bodyHost.innerHTML = "";
    picker = buildCheckboxPicker([{ label: null, items }], selectedNow);
    bodyHost.appendChild(picker.el);
    hint.textContent = _dependencyHintText_(fdef, controlsByKey, dep ? dep.length : null);
  }
  rebuild(val || fdef.default || []);

  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [el("label", { text: fdef.label || fdef.key }), bodyHost, hint]);
  return {
    wrapEl: wrap,
    get: () => picker.get(),
    set: (v) => rebuild(v),
    refreshFromDependency: () => rebuild()
  };
}
