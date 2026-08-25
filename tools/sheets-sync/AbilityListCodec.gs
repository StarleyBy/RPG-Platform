/**
 * Мини-синтаксис для поля "Список способностей" (ability_list) в одной
 * ячейке. Несколько способностей разделяются ";", поля внутри одной
 * способности — ":".
 *
 *   глагол:цель:область:модификатор:значение:условие[:формула[:заметка]]
 *
 * Пример (можно писать и по-русски, и по-английски вперемешку):
 *   увеличивает:crit_chance:на себя:в процентах:10:при крите
 *   grants:fire_damage:self:flat:5-9:on_hit::ключевой ингредиент
 *
 * Каждый сегмент (кроме значения/формулы/заметки) прогоняется через
 * resolveToken() — то есть можно писать и русское слово, и английский
 * токен, а не угадавшие в словарь варианты остаются "как есть" (это и
 * есть allow_custom-поведение, то же самое, что в HTML-редакторе).
 */

var ABILITY_FIELD_ORDER = ["verb", "target", "scope", "modifier_type", "value", "condition", "formula", "note"];

function parseAbilityListCell(text, vocab) {
  var raw = String(text || "").trim();
  if (!raw) return [];

  var vocabOptions = {
    verb: vocab.ability_verbs || [],
    target: vocab.ability_targets || [],
    scope: vocab.ability_scopes || ["self"],
    modifier_type: vocab.ability_modifiers || ["flat"],
    condition: vocab.ability_conditions || ["none"]
  };

  var chunks = raw.split(";");
  var out = [];
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i].trim();
    if (!chunk) continue;
    var parts = chunk.split(":");
    var row = {};
    for (var f = 0; f < ABILITY_FIELD_ORDER.length; f++) {
      var fieldName = ABILITY_FIELD_ORDER[f];
      var value = (parts[f] !== undefined ? parts[f].trim() : "");
      if (vocabOptions[fieldName]) {
        row[fieldName] = value ? resolveToken(value, vocabOptions[fieldName]) : (fieldName === "scope" ? "self" : fieldName === "modifier_type" ? "flat" : fieldName === "condition" ? "none" : "");
      } else {
        row[fieldName] = value; // value / formula / note — свободный текст
      }
    }
    out.push(row);
  }
  return out;
}

// Обратное преобразование — пригодится, если захочется подтянуть уже
// существующие JSON-манифесты обратно в таблицу для правки.
function serializeAbilityList(rows) {
  if (!rows || !rows.length) return "";
  var chunks = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var parts = ABILITY_FIELD_ORDER.map(function (f) { return r[f] !== undefined ? String(r[f]) : ""; });
    // убираем хвостовые пустые part'ы (formula/note), чтобы не мусорить лишними ":"
    while (parts.length && parts[parts.length - 1] === "") parts.pop();
    chunks.push(parts.join(":"));
  }
  return chunks.join("; ");
}
