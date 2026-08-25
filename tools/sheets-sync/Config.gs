/**
 * Настройки хранятся в Script Properties (Проект Apps Script → Настройки
 * проекта → Свойства скрипта), а не в коде — чтобы их можно было менять
 * из меню "⚙️ Настройки" без правки скрипта.
 *
 * SOURCE_MODE:
 *   "drive"  — схемы/словари читаются из указанных папок на Google Диске
 *              (надёжный вариант по умолчанию: не зависит от того, публичный
 *              ли репозиторий на GitHub).
 *   "github" — схемы/словари читаются напрямую с raw.githubusercontent.com
 *              (удобно, если репозиторий публичный и всегда актуален).
 */

var PROP_KEYS = {
  SOURCE_MODE: "SOURCE_MODE",
  DRIVE_SCHEMA_FOLDER_ID: "DRIVE_SCHEMA_FOLDER_ID",
  DRIVE_VOCAB_FOLDER_ID: "DRIVE_VOCAB_FOLDER_ID",
  DRIVE_OUTPUT_ROOT_FOLDER_ID: "DRIVE_OUTPUT_ROOT_FOLDER_ID",
  GITHUB_OWNER: "GITHUB_OWNER",
  GITHUB_REPO: "GITHUB_REPO",
  GITHUB_BRANCH: "GITHUB_BRANCH"
};

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    sourceMode: props.getProperty(PROP_KEYS.SOURCE_MODE) || "drive",
    driveSchemaFolderId: props.getProperty(PROP_KEYS.DRIVE_SCHEMA_FOLDER_ID) || "",
    driveVocabFolderId: props.getProperty(PROP_KEYS.DRIVE_VOCAB_FOLDER_ID) || "",
    driveOutputRootFolderId: props.getProperty(PROP_KEYS.DRIVE_OUTPUT_ROOT_FOLDER_ID) || "",
    githubOwner: props.getProperty(PROP_KEYS.GITHUB_OWNER) || "",
    githubRepo: props.getProperty(PROP_KEYS.GITHUB_REPO) || "",
    githubBranch: props.getProperty(PROP_KEYS.GITHUB_BRANCH) || "main"
  };
}

function saveConfig(cfg) {
  var props = PropertiesService.getScriptProperties();
  var toSave = {};
  toSave[PROP_KEYS.SOURCE_MODE] = cfg.sourceMode;
  toSave[PROP_KEYS.DRIVE_SCHEMA_FOLDER_ID] = cfg.driveSchemaFolderId;
  toSave[PROP_KEYS.DRIVE_VOCAB_FOLDER_ID] = cfg.driveVocabFolderId;
  toSave[PROP_KEYS.DRIVE_OUTPUT_ROOT_FOLDER_ID] = cfg.driveOutputRootFolderId;
  toSave[PROP_KEYS.GITHUB_OWNER] = cfg.githubOwner;
  toSave[PROP_KEYS.GITHUB_REPO] = cfg.githubRepo;
  toSave[PROP_KEYS.GITHUB_BRANCH] = cfg.githubBranch;
  props.setProperties(toSave);
}

// Группы категорий — те же, что в HTML-редакторе и Godot-схемах (единый
// источник понятий, просто продублирован тут для подписи вкладок).
var GROUP_LABELS = {
  equipment: "⚔️ Экипировка",
  resource: "🌿 Ресурсы и материалы",
  consumable: "🧪 Расходники",
  knowledge: "📜 Знания и документы",
  enemy: "🐉 Существа и враги",
  world: "🗺️ Мир и Локации",
  misc: "📦 Прочее"
};

// Технические (служебные) листы, которые никогда не считаются "категорией".
var RESERVED_SHEET_NAMES = ["_Списки", "_Настройки", "_Отчёт об экспорте"];
