/**
 * Строит/обновляет вкладки листа по схемам — НЕДЕСТРУКТИВНО. Колонки
 * ищутся и сопоставляются по стабильному colKey (см. SheetLayout.gs),
 * а не по порядковому номеру, поэтому изменение порядка полей в схеме
 * не портит уже введённые данные. Существующие лишние колонки (поле
 * убрали из схемы) не удаляются — только помечаются как устаревшие.
 */

function rebuildAllSheets() {
  var schemas = loadSchemas();
  var vocab = loadVocab();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];

  for (var i = 0; i < schemas.length; i++) {
    var schema = schemas[i];
    var result = ensureSheetForSchema(ss, schema, vocab);
    report.push(schema.label + ": " + result);
  }

  _ensureListsSheet_(ss, vocab);
  return report;
}

function ensureSheetForSchema(ss, schema, vocab) {
  var tabName = sheetTabName(schema);
  var sheet = ss.getSheetByName(tabName);
  var isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    isNew = true;
  }

  var columns = computeColumns(schema);
  var maxDataRow = Math.max(sheet.getMaxRows(), 300);
  if (sheet.getMaxRows() < maxDataRow) sheet.insertRowsAfter(sheet.getMaxRows(), maxDataRow - sheet.getMaxRows());

  // колонка "№" — всегда первая, чисто косметическая
  sheet.getRange(1, 1).setValue("№").setFontWeight("bold").setNote("__row_number__");

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var existingKeys = {}; // colKey -> colIndex
  if (lastCol > 1) {
    var notes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
    for (var c = 0; c < notes.length; c++) {
      if (notes[c]) existingKeys[notes[c]] = c + 1;
    }
  }

  var nextFreeCol = lastCol + 1;
  var addedCount = 0, updatedCount = 0;

  for (var i = 0; i < columns.length; i++) {
    var col = columns[i];
    var colIndex = existingKeys[col.colKey];
    if (!colIndex) {
      colIndex = nextFreeCol;
      nextFreeCol++;
      addedCount++;
    } else {
      updatedCount++;
    }

    var headerCell = sheet.getRange(1, colIndex);
    headerCell.setValue(col.header).setFontWeight("bold").setNote(col.colKey)
      .setBackground(_headerColorFor_(col));

    var dataRange = sheet.getRange(2, colIndex, maxDataRow - 1, 1);
    _applyValidationForColumn_(dataRange, col, vocab);
  }

  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, nextFreeCol - 1); } catch (e) { /* не критично */ }

  return isNew ? ("создан, колонок: " + columns.length)
    : ("обновлён (" + addedCount + " новых колонок, " + updatedCount + " сверено)");
}

function _headerColorFor_(col) {
  if (col.kind === "id") return "#fff2cc";
  if (col.kind === "section_toggle") return "#d0e0e3";
  return "#f3f3f3";
}

function _applyValidationForColumn_(range, col, vocab) {
  if (col.kind === "bool" || col.kind === "section_toggle") {
    range.insertCheckboxes();
    return;
  }
  if (col.kind === "enum") {
    var ruOptions = ruLabelsForField(col.fdef, vocab);
    if (col.fdef.allow_custom) ruOptions.push("— свой вариант —");
    if (ruOptions.length) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(ruOptions, true)
        .setAllowInvalid(!!col.fdef.allow_custom) // allow_custom -> не блокируем ввод произвольного текста
        .build();
      range.setDataValidation(rule);
    }
    return;
  }
  // string/text/int/float/range/color/tags/formula/ability_list/reference/id — свободный ввод
  range.clearDataValidations();
}

function _ensureListsSheet_(ss, vocab) {
  // Справочный лист со всеми словарями — не обязателен для экспорта
  // (Data Validation уже содержит списки), но удобен для быстрого просмотра
  // "что вообще доступно" без открытия JSON.
  var sheet = ss.getSheetByName("_Списки");
  if (!sheet) sheet = ss.insertSheet("_Списки");
  sheet.clear();
  var col = 1;
  for (var key in vocab) {
    var arr = vocab[key];
    if (!Array.isArray(arr)) continue;
    sheet.getRange(1, col).setValue(key).setFontWeight("bold");
    var ruValues = arr.filter(function (o) { return o !== "custom..."; }).map(function (o) {
      return ruLabel(o) + "  (" + o + ")";
    });
    if (ruValues.length) {
      sheet.getRange(2, col, ruValues.length, 1).setValues(ruValues.map(function (v) { return [v]; }));
    }
    col++;
  }
  sheet.setFrozenRows(1);
}
