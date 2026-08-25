/**
 * Загрузка схем (data/schemas/*.json) и словарей (data/vocab/*.json).
 * Схемы и словари — ЕДИНСТВЕННЫЙ источник правды (тот же, что использует
 * Godot ContentEditor и HTML-редактор). Этот файл их не меняет, только
 * читает — либо с Google Диска, либо напрямую с GitHub.
 */

function loadSchemas() {
  var cfg = getConfig();
  var files = (cfg.sourceMode === "github")
    ? _listGithubJson_(cfg, "data/schemas")
    : _listDriveJson_(cfg.driveSchemaFolderId);

  var schemas = [];
  for (var i = 0; i < files.length; i++) {
    try {
      var data = JSON.parse(files[i].content);
      if (data && data.id) schemas.push(data);
    } catch (e) {
      Logger.log("Схема не распарсена (" + files[i].name + "): " + e);
    }
  }
  schemas.sort(function (a, b) {
    var order = ["equipment", "resource", "consumable", "knowledge", "enemy", "world", "misc"];
    var oa = order.indexOf(a.group || "misc");
    var ob = order.indexOf(b.group || "misc");
    if (oa !== ob) return oa - ob;
    return (a.label || "").localeCompare(b.label || "");
  });
  return schemas;
}

function loadVocab() {
  var cfg = getConfig();
  var files = (cfg.sourceMode === "github")
    ? _listGithubJson_(cfg, "data/vocab")
    : _listDriveJson_(cfg.driveVocabFolderId);

  var vocab = {};
  for (var i = 0; i < files.length; i++) {
    var key = files[i].name.replace(/\.json$/, "");
    try {
      vocab[key] = JSON.parse(files[i].content);
    } catch (e) {
      Logger.log("Словарь не распарсен (" + files[i].name + "): " + e);
    }
  }
  return vocab;
}

// --- Google Drive ---------------------------------------------------------

function _listDriveJson_(folderId) {
  if (!folderId) {
    throw new Error("Не указана папка на Google Диске. Открой меню ⚙️ Настройки и укажи ID папки.");
  }
  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFilesByType(MimeType.PLAIN_TEXT);
  var out = _collectDriveFiles_(it);
  // JSON-файлы Google иногда определяет как application/json, а не text/plain —
  // проверяем оба варианта, чтобы не потерять файлы из-за MIME-угадывания.
  var it2 = folder.getFilesByType("application/json");
  out = out.concat(_collectDriveFiles_(it2));
  return out;
}

function _collectDriveFiles_(it) {
  var out = [];
  var seen = {};
  while (it.hasNext()) {
    var f = it.next();
    if (!f.getName().match(/\.json$/i)) continue;
    if (seen[f.getId()]) continue;
    seen[f.getId()] = true;
    out.push({ name: f.getName(), content: f.getBlob().getDataAsString("UTF-8") });
  }
  return out;
}

// --- GitHub ----------------------------------------------------------------

function _listGithubJson_(cfg, prefix) {
  if (!cfg.githubOwner || !cfg.githubRepo) {
    throw new Error("Не указаны владелец/репозиторий GitHub в настройках.");
  }
  var treeUrl = "https://api.github.com/repos/" + cfg.githubOwner + "/" + cfg.githubRepo +
    "/git/trees/" + cfg.githubBranch + "?recursive=1";
  var treeResp = UrlFetchApp.fetch(treeUrl, { muteHttpExceptions: true });
  if (treeResp.getResponseCode() !== 200) {
    throw new Error("GitHub tree API вернул " + treeResp.getResponseCode() + ": " + treeResp.getContentText());
  }
  var tree = JSON.parse(treeResp.getContentText()).tree;
  var paths = [];
  for (var i = 0; i < tree.length; i++) {
    var node = tree[i];
    if (node.type === "blob" && node.path.indexOf(prefix) === 0 && node.path.slice(-5) === ".json") {
      paths.push(node.path);
    }
  }

  var out = [];
  for (var j = 0; j < paths.length; j++) {
    var rawUrl = "https://raw.githubusercontent.com/" + cfg.githubOwner + "/" + cfg.githubRepo +
      "/" + cfg.githubBranch + "/" + paths[j];
    var resp = UrlFetchApp.fetch(rawUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      var name = paths[j].split("/").pop();
      out.push({ name: name, content: resp.getContentText() });
    } else {
      Logger.log("Не удалось скачать " + rawUrl + " (" + resp.getResponseCode() + ")");
    }
  }
  return out;
}
