/**
 * level_track — прогрессия профессии/класса по уровням. Каждая строка:
 * уровень + что открывается на нём (способности, ресурсы) + заметка.
 *
 * Пример (шахтёр): уровень 5 -> "unlocks_resources": [ID полудрагоценных
 * камней/рун/готовых слитков, которые уже существуют как манифесты] +
 * заметка "с этого уровня появляется шанс побочной добычи, растёт на
 * 0.5%/уровень после 5-го". Сам процент растущего шанса — через формулу
 * в соседнем поле профессии (см. profession.json → scaling_bonus), а не
 * здесь: level_track отвечает за ЧТО открывается и на каком уровне, а не
 * за то, как именно растёт вероятность.
 */

function buildLevelTrackField(fdef, val) {
  const rows = [];
  const rowsHost = el("div", { class: "level-track" });

  function addRow(data) {
    data = data || {};
    const levelInput = el("input", { type: "number", value: data.level || 1, min: 1, max: 100 });
    const rmBtn = el("button", { class: "rm", text: "✕ Удалить уровень" });

    const abilitiesField = buildManifestMultirefField(
      { label: "Открывает способности", ref_type: "ability" }, data.unlocks_abilities || [], true);
    const resourcesField = buildManifestMultirefField(
      { label: "Открывает добычу/крафт ресурсов", ref_type: ["material_raw", "gem_rune", "plant_organic", "monster_animal_part"] },
      data.unlocks_resources || [], true);

    const noteInput = el("input", {
      type: "text", value: data.note || "",
      placeholder: "заметка, например: «шанс побочной добычи растёт на 0.5% за уровень после 5-го»"
    });

    const head = el("div", { class: "level-row-head" }, [el("span", { text: "Уровень:" }), levelInput, rmBtn]);
    const grid = el("div", { class: "level-row-grid" }, [abilitiesField.wrapEl, resourcesField.wrapEl]);
    const noteWrap = el("div", { class: "level-row-note" }, [noteInput]);
    const rowEl = el("div", { class: "level-row" }, [head, grid, noteWrap]);

    const rowObj = {
      el: rowEl,
      get: () => ({
        level: parseInt(levelInput.value, 10) || 1,
        unlocks_abilities: abilitiesField.get(),
        unlocks_resources: resourcesField.get(),
        note: noteInput.value
      })
    };
    rmBtn.addEventListener("click", () => {
      rowsHost.removeChild(rowEl);
      rows.splice(rows.indexOf(rowObj), 1);
    });

    rowsHost.appendChild(rowEl);
    rows.push(rowObj);
  }

  const addBtn = el("button", { class: "add-level-btn", text: "➕ Добавить уровень открытия" });
  addBtn.addEventListener("click", () => addRow(null));
  for (const r of (val || fdef.default || [])) addRow(r);

  const wrap = el("div", { class: "field-block", style: "grid-column:1/-1" }, [
    el("label", { text: fdef.label || fdef.key }), rowsHost, addBtn
  ]);
  return {
    wrapEl: wrap,
    get: () => rows.map(r => r.get()).sort((a, b) => a.level - b.level),
    set: (v) => { rowsHost.innerHTML = ""; rows.length = 0; for (const r of (v || [])) addRow(r); }
  };
}
