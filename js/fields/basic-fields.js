/**
 * Фабрика простых полей формы (string/text/int/float/range/bool/color/
 * tags/enum/formula) — аналог SchemaFieldFactory из Godot-версии. Опции
 * enum отображаются по-русски (ruLabel), но get() всегда возвращает
 * английское машинное значение. allow_custom=true добавляет пункт
 * "— свой вариант —" со свободным полем.
 *
 * Поля manifest_ref/manifest_multiref/vocab_multiselect/level_track
 * вынесены в js/fields/reference-fields.js — они устроены принципиально
 * иначе (тянут варианты не из статичного словаря, а из живого состояния
 * STATE.manifestIndex).
 */
const CUSTOM_MARK = "custom...";

function buildField(fdef, vocab, initialValue) {
  const type = fdef.type || "string";
  switch (type) {
    case "string": case "id": case "reference": return buildStringField(fdef, initialValue);
    case "text": return buildTextField(fdef, initialValue);
    case "int": return buildNumberField(fdef, initialValue, true);
    case "float": return buildNumberField(fdef, initialValue, false);
    case "range": return buildRangeField(fdef, initialValue);
    case "bool": return buildBoolField(fdef, initialValue);
    case "color": return buildColorField(fdef, initialValue);
    case "tags": return buildTagsField(fdef, initialValue);
    case "enum": return buildEnumField(fdef, vocab, initialValue);
    case "formula": return buildFormulaField(fdef, initialValue);
    case "ability_list": return buildAbilityListField(fdef, vocab, initialValue);
    case "vocab_multiselect": return buildVocabMultiselectField(fdef, vocab, initialValue);
    case "manifest_ref": return buildManifestRefField(fdef, initialValue);
    case "manifest_multiref": return buildManifestMultirefField(fdef, initialValue, false);
    case "level_track": return buildLevelTrackField(fdef, initialValue);
    default: return buildStringField(fdef, initialValue);
  }
}

function fieldWrap(fdef, inner) {
  return el("div", { class: "field-block" }, [el("label", { text: fdef.label || fdef.key }), inner]);
}

function buildStringField(fdef, val) {
  const input = el("input", { type: "text", value: val ?? fdef.default ?? "" });
  return { wrapEl: fieldWrap(fdef, input), inputEl: input, get: () => input.value, set: v => input.value = v ?? "" };
}

function buildTextField(fdef, val) {
  const ta = el("textarea", { text: val ?? fdef.default ?? "" });
  return { wrapEl: fieldWrap(fdef, ta), get: () => ta.value, set: v => ta.value = v ?? "" };
}

function buildNumberField(fdef, val, isInt) {
  const input = el("input", {
    type: "number", step: isInt ? "1" : (fdef.step || 0.01),
    value: val ?? fdef.default ?? 0
  });
  return {
    wrapEl: fieldWrap(fdef, input),
    get: () => isInt ? parseInt(input.value || "0", 10) : parseFloat(input.value || "0"),
    set: v => input.value = v ?? 0
  };
}

function buildRangeField(fdef, val) {
  const def = fdef.default || [0, 0];
  const v = val || def;
  const mn = el("input", { type: "number", value: v[0] });
  const sep = el("span", { text: "–" });
  const mx = el("input", { type: "number", value: v[1] });
  const wrap = el("div", { class: "field-block range-field" }, [
    el("label", { text: fdef.label || fdef.key, style: "flex-basis:100%" }), mn, sep, mx
  ]);
  return {
    wrapEl: wrap,
    get: () => [parseFloat(mn.value || "0"), parseFloat(mx.value || "0")],
    set: v => { mn.value = (v && v[0]) ?? 0; mx.value = (v && v[1]) ?? 0; }
  };
}

function buildBoolField(fdef, val) {
  const input = el("input", { type: "checkbox" });
  input.checked = val ?? fdef.default ?? false;
  const wrap = el("div", { class: "field-block" }, [
    el("label", {}, [input, document.createTextNode(" " + (fdef.label || fdef.key))])
  ]);
  return { wrapEl: wrap, get: () => input.checked, set: v => input.checked = !!v };
}

function buildColorField(fdef, val) {
  const input = el("input", { type: "color", value: val || fdef.default || "#ffffff" });
  return { wrapEl: fieldWrap(fdef, input), get: () => input.value, set: v => input.value = v || "#ffffff" };
}

function buildTagsField(fdef, val) {
  const arr = val || fdef.default || [];
  const input = el("input", { type: "text", value: arr.join(", "), placeholder: "тег1, тег2, ..." });
  return {
    wrapEl: fieldWrap(fdef, input),
    get: () => input.value.split(",").map(s => s.trim()).filter(Boolean),
    set: v => input.value = (v || []).join(", ")
  };
}

// enum: показываем ruLabel(значение) в тексте <option>, но value остаётся
// английским машинным токеном. allow_custom=true добавляет пункт
// "— свой вариант —" со свободным текстовым полем рядом (то же самое,
// что делают строки ability_list).
function optionsForField(fdef, vocab) {
  let options = fdef.options || [];
  if (!options.length && fdef.options_ref) options = vocab[fdef.options_ref] || [];
  return options.filter(o => o !== CUSTOM_MARK);
}

function buildEnumField(fdef, vocab, val) {
  const options = optionsForField(fdef, vocab);

  const select = el("select");
  for (const o of options) select.appendChild(el("option", { value: o, text: ruLabel(o) }));

  let customInput = null;
  if (fdef.allow_custom) {
    select.appendChild(el("option", { value: CUSTOM_MARK, text: "— свой вариант —" }));
    customInput = el("input", { type: "text", placeholder: "свой вариант...", style: "margin-top:6px;display:none" });
    select.addEventListener("change", () => {
      customInput.style.display = select.value === CUSTOM_MARK ? "" : "none";
    });
  }

  const initial = val ?? (options[fdef.default_index || 0] || "");
  if (options.includes(initial)) {
    select.value = initial;
  } else if (fdef.allow_custom) {
    select.value = CUSTOM_MARK;
    customInput.value = initial;
    customInput.style.display = "";
  } else {
    select.value = initial;
  }

  const children = [el("label", { text: fdef.label || fdef.key }), select];
  if (customInput) children.push(customInput);
  const wrap = el("div", { class: "field-block" }, children);

  return {
    wrapEl: wrap,
    get: () => (fdef.allow_custom && select.value === CUSTOM_MARK) ? customInput.value : select.value,
    set: (v) => {
      if (options.includes(v)) { select.value = v; if (customInput) customInput.style.display = "none"; }
      else if (fdef.allow_custom) { select.value = CUSTOM_MARK; customInput.value = v || ""; customInput.style.display = ""; }
      else select.value = v;
    }
  };
}

function buildFormulaField(fdef, val) {
  const input = el("input", {
    type: "text", value: val ?? fdef.default ?? "",
    placeholder: "PHYSICAL_DAMAGE * 1.15 + 0.001 * PLAYER_LEVEL"
  });
  const hint = el("div", { class: "hint", text: "Переменные: PLAYER_LEVEL, ITEM_LEVEL, BASE_VALUE, TARGET_MAX_HP, STAT_*" });
  const wrap = el("div", { class: "field-block" }, [el("label", { text: fdef.label || fdef.key }), input, hint]);
  return { wrapEl: wrap, get: () => input.value, set: v => input.value = v ?? "" };
}

/* --- ability_list: бесконечный конструктор способностей.
   Выпадающие списки показывают русский перевод глагола/цели/области/
   модификатора/условия, но get() всегда возвращает английский токен. --- */

