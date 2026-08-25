/**
 * Меню таблицы + установка живого триггера проверки ID. Это единственная
 * точка входа для пользователя — весь остальной код вызывается отсюда.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🎮 RPG Manifest")
    .addItem("🔄 Обновить структуру листов из схем", "menu_rebuildSheets")
    .addSeparator()
    .addItem("✅ Проверить дубликаты ID по всем листам", "menu_checkDuplicateIds")
    .addItem("📤 Экспортировать всё в Google Диск", "menu_exportAll")
    .addSeparator()
    .addItem("⚙️ Настройки источника данных", "menu_openSettings")
    .addItem("🔔 Включить живую проверку ID при вводе", "menu_installTrigger")
    .addToUi();
}

function menu_rebuildSheets() {
  var ui = SpreadsheetApp.getUi();
  try {
    var report = rebuildAllSheets();
    ui.alert("Готово.\n\n" + report.join("\n"));
  } catch (e) {
    ui.alert("Ошибка: " + e.message);
  }
}

function menu_checkDuplicateIds() {
  var ui = SpreadsheetApp.getUi();
  var conflicts = scanAllIds();
  if (conflicts.length === 0) {
    ui.alert("✅ Конфликтов ID не найдено.");
    return;
  }
  var msg = "Найдены повторяющиеся ID:\n\n";
  for (var i = 0; i < conflicts.length; i++) {
    var occ = conflicts[i].occurrences.map(function (o) { return o.sheet + " (стр. " + o.row + ")"; }).join(", ");
    msg += "• \"" + conflicts[i].id + "\" — " + occ + "\n";
  }
  ui.alert(msg);
}

function menu_exportAll() {
  try {
    exportAllSheets();
  } catch (e) {
    SpreadsheetApp.getUi().alert("Ошибка экспорта: " + e.message);
  }
}

function menu_installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onEditIdCheck") {
      SpreadsheetApp.getUi().alert("Живая проверка ID уже включена.");
      return;
    }
  }
  ScriptApp.newTrigger("onEditIdCheck")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert("✅ Включено. Теперь при вводе ID ячейка будет подсвечиваться зелёным/красным сразу.");
}

function menu_openSettings() {
  var html = HtmlService.createHtmlOutputFromFile("SettingsDialog")
    .setWidth(480).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, "⚙️ Настройки источника данных");
}

// Вызывается из SettingsDialog.html
function ui_getConfig() {
  return getConfig();
}
function ui_saveConfig(cfg) {
  saveConfig(cfg);
  return "Сохранено.";
}
