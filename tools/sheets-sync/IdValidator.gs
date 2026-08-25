/**
 * Уникальность ID — глобальная по всему проекту (см. обоснование в
 * HTML-редакторе: десятки типов манифестов ссылаются друг на друга по ID,
 * единый пул проще и безопаснее, чем уникальность "в рамках категории").
 *
 * Два режима проверки:
 *   - checkSingleId()  — быстрая проверка одного значения (используется
 *     живым onEdit-триггером сразу при вводе ID);
 *   - scanAllIds()     — полное сканирование всех листов-категорий
 *     (используется перед экспортом, жёстко блокирует его при конфликте).
 */

function scanAllIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var idMap = {}; // id -> [{sheet, row}]

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (RESERVED_SHEET_NAMES.indexOf(sheet.getName()) !== -1) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;
    var idColValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // колонка B = ID

    for (var r = 0; r < idColValues.length; r++) {
      var id = String(idColValues[r][0] || "").trim();
      if (!id) continue;
      if (!idMap[id]) idMap[id] = [];
      idMap[id].push({ sheet: sheet.getName(), row: r + 2 });
    }
  }

  var conflicts = [];
  for (var id in idMap) {
    if (idMap[id].length > 1) conflicts.push({ id: id, occurrences: idMap[id] });
  }
  return conflicts;
}

function checkSingleId(idValue, currentSheetName, currentRow) {
  if (!idValue) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (RESERVED_SHEET_NAMES.indexOf(sheet.getName()) !== -1) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;
    var idColValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

    for (var r = 0; r < idColValues.length; r++) {
      var rowNum = r + 2;
      if (sheet.getName() === currentSheetName && rowNum === currentRow) continue; // сама ячейка
      var id = String(idColValues[r][0] || "").trim();
      if (id === idValue) {
        return { sheet: sheet.getName(), row: rowNum };
      }
    }
  }
  return null;
}

/**
 * Устанавливается как installable-триггер onEdit (см. Menu.gs → setupTriggers).
 * Живая проверка прямо в ячейке ID: зелёная заливка = свободен,
 * красная = конфликт (с всплывающей заметкой, где именно занято).
 */
function onEditIdCheck(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (RESERVED_SHEET_NAMES.indexOf(sheet.getName()) !== -1) return;
  if (range.getColumn() !== 2 || range.getRow() < 2) return; // колонка B = ID, строка данных

  var idValue = String(range.getValue() || "").trim();
  if (!idValue) { range.setBackground(null).setNote(""); return; }

  var conflict = checkSingleId(idValue, sheet.getName(), range.getRow());
  if (conflict) {
    range.setBackground("#f4cccc");
    range.setNote("⚠️ ID уже используется на листе \"" + conflict.sheet + "\", строка " + conflict.row);
  } else {
    range.setBackground("#d9ead3");
    range.setNote("✓ ID свободен");
  }
}
