/**
 * Экспорт заполненных строк во все листы → JSON-манифесты в папках на
 * Google Диске, повторяя структуру game_data/**, которую использует и
 * HTML-редактор, и Godot ContentEditor.
 *
 * Жёстко останавливается, если найден конфликт ID где угодно в таблице —
 * ни один файл в этом случае не пишется (всё или ничего), чтобы не
 * получить наполовину рассинхронизированный game_data.
 */

function exportAllSheets() {
  var conflicts = scanAllIds();
  if (conflicts.length > 0) {
    var msg = "Экспорт остановлен — найдены повторяющиеся ID:\n\n";
    for (var i = 0; i < conflicts.length; i++) {
      var occ = conflicts[i].occurrences.map(function (o) { return o.sheet + " (строка " + o.row + ")"; }).join(", ");
      msg += "• \"" + conflicts[i].id + "\" — " + occ + "\n";
    }
    msg += "\nИсправь дубликаты и запусти экспорт снова.";
    SpreadsheetApp.getUi().alert(msg);
    return { ok: false, conflicts: conflicts };
  }

  var cfg = getConfig();
  if (!cfg.driveOutputRootFolderId) {
    SpreadsheetApp.getUi().alert("Не указана папка вывода на Google Диске (меню ⚙️ Настройки).");
    return { ok: false };
  }
  var rootFolder = DriveApp.getFolderById(cfg.driveOutputRootFolderId);

  var schemas = loadSchemas();
  var vocab = loadVocab();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var totalWritten = 0;
  var report = [];

  for (var i = 0; i < schemas.length; i++) {
    var schema = schemas[i];
    var sheet = ss.getSheetByName(sheetTabName(schema));
    if (!sheet) continue;

    var written = _exportSheet_(sheet, schema, vocab, rootFolder);
    totalWritten += written;
    if (written > 0) report.push(schema.label + ": " + written);
  }

  _writeExportReport_(ss, report, totalWritten);
  SpreadsheetApp.getUi().alert("Экспорт завершён. Файлов записано: " + totalWritten + ".\nПодробности — на листе \"_Отчёт об экспорте\".");
  return { ok: true, totalWritten: totalWritten, report: report };
}

function _exportSheet_(sheet, schema, vocab, rootFolder) {
  var columns = computeColumns(schema);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;

  var notes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
  var colIndexByKey = {};
  for (var c = 0; c < notes.length; c++) {
    if (notes[c]) colIndexByKey[notes[c]] = c + 1; // 1-based
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var pathSegments = _savePathToSegments_(schema.save_path);
  var targetFolder = _getOrCreateFolderPath_(rootFolder, pathSegments.folders);

  var written = 0;
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var idColIdx = colIndexByKey["id"];
    var idValue = idColIdx ? String(row[idColIdx - 1] || "").trim() : "";
    if (!idValue) continue; // пустая строка — пропускаем

    var obj = _buildObjectFromRow_(row, columns, colIndexByKey, schema, vocab);
    var fileName = idValue + ".json";
    _writeOrOverwriteFile_(targetFolder, fileName, JSON.stringify(obj, null, "\t"));
    written++;
  }
  return written;
}

function _buildObjectFromRow_(row, columns, colIndexByKey, schema, vocab) {
  var obj = { type: schema.id, group: schema.group };
  var sections = {}; // sectionKey -> {enabled, fields:{}}

  for (var i = 0; i < columns.length; i++) {
    var col = columns[i];
    var colIndex = colIndexByKey[col.colKey];
    if (!colIndex) continue; // колонки нет на листе (лист ещё не обновляли)
    var rawValue = row[colIndex - 1];

    var parsedValue = _parseCellValue_(rawValue, col, vocab);

    if (col.sectionKey === null) {
      obj[col.colKey] = parsedValue;
    } else {
      if (!sections[col.sectionKey]) sections[col.sectionKey] = { enabled: false, fields: {} };
      if (col.kind === "section_toggle") {
        sections[col.sectionKey].enabled = !!rawValue;
      } else {
        var fieldKey = col.colKey.split(".").slice(1).join(".");
        sections[col.sectionKey].fields[fieldKey] = parsedValue;
      }
    }
  }

  for (var sectionKey in sections) {
    var s = sections[sectionKey];
    var sectionOut = { enabled: s.enabled };
    if (s.enabled) {
      for (var fk in s.fields) sectionOut[fk] = s.fields[fk];
    }
    obj[sectionKey] = sectionOut;
  }

  return obj;
}

function _parseCellValue_(rawValue, col, vocab) {
  switch (col.kind) {
    case "id": case "string": case "text": case "reference": case "formula":
      return String(rawValue || "");
    case "int":
      return parseInt(rawValue, 10) || 0;
    case "float":
      return parseFloat(rawValue) || 0;
    case "bool":
      return !!rawValue;
    case "color":
      return String(rawValue || "#ffffff");
    case "tags":
      return String(rawValue || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    case "range":
      var parts = String(rawValue || "0-0").split("-");
      return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0];
    case "enum":
      var options = optionsForField(col.fdef, vocab);
      return resolveToken(rawValue, options);
    case "ability_list":
      return parseAbilityListCell(rawValue, vocab);
    default:
      return rawValue;
  }
}

// --- Google Drive helpers ---------------------------------------------------

function _savePathToSegments_(savePathTemplate) {
  var withoutProto = savePathTemplate.replace("res://", "");
  var parts = withoutProto.split("/");
  parts.pop(); // убираем "%s.json"
  return { folders: parts };
}

function _getOrCreateFolderPath_(rootFolder, segments) {
  var folder = rootFolder;
  for (var i = 0; i < segments.length; i++) {
    folder = _getOrCreateSubfolder_(folder, segments[i]);
  }
  return folder;
}

function _getOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function _writeOrOverwriteFile_(folder, fileName, content) {
  var it = folder.getFilesByName(fileName);
  while (it.hasNext()) it.next().setTrashed(true); // перезапись = удалить старую версию + создать новую
  folder.createFile(fileName, content, "application/json");
}

function _writeExportReport_(ss, report, totalWritten) {
  var sheet = ss.getSheetByName("_Отчёт об экспорте");
  if (!sheet) sheet = ss.insertSheet("_Отчёт об экспорте");
  sheet.clear();
  sheet.getRange(1, 1).setValue("Экспорт от " + new Date().toLocaleString()).setFontWeight("bold");
  sheet.getRange(2, 1).setValue("Всего файлов: " + totalWritten);
  var rows = report.map(function (line) { return [line]; });
  if (rows.length) sheet.getRange(4, 1, rows.length, 1).setValues(rows);
}
