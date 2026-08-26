/**
 * level_track — прогрессия профессии/класса по уровням. Каждая строка:
 * уровень + требования для его достижения + что открывается по достижении.
 *
 * "Требования" (requirements) — отдельный список внутри строки уровня,
 * не путать с "что открывается" (unlocks_*). Пример (шахтёр, переход на
 * 2 уровень): required_experience=100 + требование "Добыть 20 руды" +
 * требование "Добыть руду минимум из 3 разных источников" (gather_diversity,
 * amount=3, target_pool = сама руда — считаем количество РАЗНЫХ выбранных
 * материалов, из которых был хотя бы один сбор, а не физических точек
 * добычи в мире, которые движок пока не моделирует отдельно).
 */

function buildRequirementRow(data) {
  data = data || {};
  const reqTypeVocab = (window.STATE && STATE.vocab && STATE.vocab.requirement_types) ||
    ["gather_quantity", "gather_diversity", "craft_quantity", "kill_count", "quest_complete", "custom..."];
  const reqType = comboWithCustom(reqTypeVocab);
  reqType.set(data.req_type || "gather_quantity");

  const amountInput = el("input", { type: "number", value: data.amount ?? 1, min: 0, placeholder: "кол-во / мин. источников" });
  const rmBtn = el("button", { class: "rm", text: "✕" });

  const targetPoolField = buildManifestMultirefField(
    { label: "Цель требования (что считать)", ref_type: ["material_raw", "gem_rune", "plant_organic", "monster_animal_part", "enemy_base", "quest_item"] },
    data.target_pool || [], true);

  const noteInput = el("input", {
    type: "text", value: data.note || "",
    placeholder: "заметка, например: «считать только источники руды, не любых материалов»"
  });

  const head = el("div", { class: "requirement-row-head" }, [
    reqType.select, reqType.customInput,
    el("span", { text: "×" }), amountInput, rmBtn
  ]);
  const noteWrap = el("div", { class: "requirement-row-note" }, [noteInput]);
  const rowEl = el("div", { class: "requirement-row" }, [head, targetPoolField.wrapEl, noteWrap]);

  const rowObj = {
    el: rowEl,
    get: () => ({
      req_type: reqType.get(),
      amount: parseInt(amountInput.value, 10) || 0,
      target_pool: targetPoolField.get(),
      note: noteInput.value
    })
  };
  rmBtn.addEventListener("click", () => rowObj._remove && rowObj._remove());
  return rowObj;
}

function buildRequirementListField(initialRows) {
  const rows = [];
  const host = el("div", { class: "requirement-list" });

  function addRow(data) {
    const row = buildRequirementRow(data);
    row._remove = () => { host.removeChild(row.el); rows.splice(rows.indexOf(row), 1); };
    host.appendChild(row.el);
    rows.push(row);
  }
  for (const r of (initialRows || [])) addRow(r);

  const addBtn = el("button", { class: "add-requirement-btn", text: "➕ Добавить требование" });
  addBtn.addEventListener("click", () => addRow(null));

  const wrap = el("div", {}, [
    el("span", { class: "level-row-requirements-label", text: "📋 Требования для достижения этого уровня" }),
    host, addBtn
  ]);
  return { wrapEl: wrap, get: () => rows.map(r => r.get()) };
}

function buildLevelTrackField(fdef, val) {
  const rows = [];
  const rowsHost = el("div", { class: "level-track" });

  function addRow(data) {
    data = data || {};
    const levelInput = el("input", { type: "number", value: data.level || 1, min: 1, max: 100 });
    const rmBtn = el("button", { class: "rm", text: "✕ Удалить уровень" });

    const xpInput = el("input", { type: "number", value: data.required_experience ?? 0, min: 0 });
    const xpRow = el("div", { class: "level-row-xp" }, [
      el("label", { text: "Требуемый опыт в профессии для перехода на этот уровень:" }), xpInput
    ]);

    const requirementsField = buildRequirementListField(data.requirements || []);

    const abilitiesField = buildManifestMultirefField(
      { label: "Открывает способности", ref_type: "ability" }, data.unlocks_abilities || [], true);
    const resourcesField = buildManifestMultirefField(
      { label: "Открывает добычу/крафт ресурсов", ref_type: ["material_raw", "gem_rune", "plant_organic", "monster_animal_part"] },
      data.unlocks_resources || [], true);

    const noteInput = el("input", {
      type: "text", value: data.note || "",
      placeholder: "общая заметка по уровню"
    });

    const head = el("div", { class: "level-row-head" }, [el("span", { text: "Уровень:" }), levelInput, rmBtn]);
    const grid = el("div", { class: "level-row-grid" }, [abilitiesField.wrapEl, resourcesField.wrapEl]);
    const noteWrap = el("div", { class: "level-row-note" }, [noteInput]);
    const rowEl = el("div", { class: "level-row" }, [head, xpRow, requirementsField.wrapEl, grid, noteWrap]);

    const rowObj = {
      el: rowEl,
      get: () => ({
        level: parseInt(levelInput.value, 10) || 1,
        required_experience: parseFloat(xpInput.value) || 0,
        requirements: requirementsField.get(),
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
