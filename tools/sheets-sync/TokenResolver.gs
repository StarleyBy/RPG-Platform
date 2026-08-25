/**
 * Разрешение введённого текста (русского ИЛИ английского) обратно в
 * английский машинный токен для конкретного поля. Поиск совпадения ведётся
 * ТОЛЬКО среди опций samого этого поля — поэтому одинаковый русский текст
 * в разных полях (если такой вообще есть) никогда не конфликтует между
 * собой, в отличие от глобального словаря.
 *
 * Если совпадения нет — значение считается "своим вариантом" (allow_custom)
 * и передаётся как есть, ровно как в HTML-редакторе.
 */

function resolveToken(inputText, options) {
  var raw = String(inputText || "").trim();
  if (!raw) return "";

  var normalized = _stripOrdinalPrefix_(raw).toLowerCase();

  for (var i = 0; i < options.length; i++) {
    if (options[i].toLowerCase() === raw.toLowerCase()) return options[i];
  }
  for (var j = 0; j < options.length; j++) {
    var label = ruLabel(options[j]);
    if (label.toLowerCase() === raw.toLowerCase()) return options[j];
    // терпимо к варианту без ведущего "6 — " (как в rarity_tiers/quality-подобных списках):
    // пользователь мог ввести "Эпическое" вместо строгого "6 — Эпическое" из выпадающего списка.
    if (_stripOrdinalPrefix_(label).toLowerCase() === normalized) return options[j];
  }
  return raw; // свой вариант
}

// "6 — Эпическое" -> "Эпическое" / "6_epic" -> "epic" (для сравнения без номера-префикса)
function _stripOrdinalPrefix_(text) {
  return String(text || "")
    .replace(/^\d+\s*[—\-]\s*/, "")  // "6 — Эпическое" -> "Эпическое"
    .replace(/^\d+_/, "");           // "6_epic" -> "epic"
}

function optionsForField(fdef, vocab) {
  var options = fdef.options || [];
  if (!options.length && fdef.options_ref) options = vocab[fdef.options_ref] || [];
  return options.filter(function (o) { return o !== "custom..."; });
}

function ruLabelsForField(fdef, vocab) {
  return optionsForField(fdef, vocab).map(ruLabel);
}
