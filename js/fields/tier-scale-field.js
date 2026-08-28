/**
 * tier_scale — названия ступеней профессии/класса и градаций внутри
 * ступени. Уровни 1-25 остаются числами (level_track ими и оперирует),
 * это поле — чисто презентационный слой поверх них: диапазон уровней
 * -> "новичок"/"подмастерье"/... + список прилагательных-градаций внутри
 * диапазона (пустая строка — первая градация без прилагательного).
 *
 * Итоговое отображаемое имя уровня N считается так:
 *   найти строку, где from_level <= N <= to_level
 *   индекс внутри диапазона = N - from_level
 *   имя = (grade_labels[индекс] + " " + tier_name).trim()
 *
 * Само вычисление имени — забота игры при отображении персонажу, редактор
 * только хранит и позволяет удобно редактировать структуру данных.
 */

function buildTierRow(data) {
  data = data || {};
  const nameInput = el("input", { type: "text", value: data.tier_name || "", placeholder: "название ступени, напр. 'новичок'" });
  const fromInput = el("input", { type: "number", value: data.from_level ?? 1, min: 1, max: 100 });
  const toInput = el("input", { type: "number", value: data.to_level ?? 1, min: 1, max: 100 });
  const gradesInput = el("input", {
    type: "text", value: (data.grade_labels || []).join(", "),
    placeholder: "градации по порядку через запятую: (пусто), способный, опытный..."
  });
  const rmBtn = el("button", { class: "rm", text: "✕" });

  const head = el("div", { class: "level-row-head" }, [
    el("span", { text: "Ступень:" }), nameInput,
    el("span", { text: "уровни" }), fromInput, el("span", { text: "–" }), toInput,
    rmBtn
  ]);
  const gradesWrap = el("div", { class: "level-row-note" }, [
    el("label", { style: "font-size:11px;color:var(--text-dim);display:block;margin-bottom:3px", text: "Градации внутри ступени (по порядку, от младшей к старшей)" }),
    gradesInput
  ]);
  const rowEl = el("div", { class: "level-row" }, [head, gradesWrap]);

  const rowObj = {
    el: rowEl,
    get: () => ({
      tier_name: nameInput.value.trim(),
      from_level: parseInt(fromInput.value, 10) || 1,
      to_level: parseInt(toInput.value, 10) || 1,
      grade_labels: gradesInput.value.split(",").map(s => s.trim())
    })
  };
  rmBtn.addEventListener("click", () => rowObj._remove && rowObj._remove());
  return rowObj;
}

function buildTierScaleField(fdef, val) {
  const rows = [];
  const host = el("div", { class: "level-track" });

  function addRow(data) {
    const row = buildTierRow(data);
    row._remove = () => { host.removeChild(row.el); rows.splice(rows.indexOf(row), 1); };
    host.appendChild(row.el);
    rows.push(row);
  }
  for (const r of (val || fdef.default || [])) addRow(r);

  const addBtn = el("button", { class: "add-level-btn", text: "➕ Добавить ступень" });
  addBtn.addEventListener("click", () => addRow(null));

  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [
    el("label", { text: fdef.label || fdef.key }), host, addBtn
  ]);
  return {
    wrapEl: wrap,
    get: () => rows.map(r => r.get()).sort((a, b) => a.from_level - b.from_level),
    set: (v) => { host.innerHTML = ""; rows.length = 0; for (const r of (v || [])) addRow(r); }
  };
}