/**
 * Глобальное состояние приложения, пути к данным и мелкие утилиты общего
 * назначения (создание DOM-узлов, работа с путями, base64, статус-бар).
 *
 * STATE объявлен через var (не const) НАМЕРЕННО — так он доступен как
 * window.STATE из консоли браузера для отладки и используется автотестами.
 */
const PATHS = {
  schemas: "data/schemas",
  vocab: "data/vocab",
  world: "game_data"
};

// var (не const) — намеренно: так STATE доступен как window.STATE из консоли
// браузера для отладки, и это же используется автотестами инструмента.
var STATE = {
  adapter: null,
  sourceLabel: "",
  schemas: [],
  schemasById: {},
  vocab: {},
  manifestIndex: [],
  currentPage: "editor",
  currentSchemaId: null
};

const GROUP_LABELS = {
  core: "🧩 Базовые элементы",
  equipment: "⚔️ Экипировка",
  resource: "🌿 Ресурсы и материалы",
  consumable: "🧪 Расходники",
  knowledge: "📜 Знания и документы",
  enemy: "🐉 Существа и враги",
  world: "🗺️ Мир и Локации",
  misc: "📦 Прочее"
};
const GROUP_ORDER = ["core","equipment","resource","consumable","knowledge","enemy","world","misc"];

/* ---------------------------------------------------------------------- */
/* Utility                                                                 */
/* ---------------------------------------------------------------------- */

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === "text") node.textContent = attrs[k];
    else if (k === "html") node.innerHTML = attrs[k];
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), attrs[k]);
    else node.setAttribute(k, attrs[k]);
  }
  if (children) for (const c of children) if (c) node.appendChild(c);
  return node;
}

function resolveSavePath(template, id) {
  return template.replace("res://", "").replace("%s", id);
}

function b64EncodeUnicode(str) {
  return btoa(unicode_to_latin1(str));
}
function unicode_to_latin1(str) {
  return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode("0x" + p1));
}

function toast(msg, isErr) {
  const box = document.getElementById("globalStatus");
  if (box) {
    box.textContent = msg;
    box.className = "status-msg" + (isErr ? " err" : "");
  }
  console.log((isErr ? "[ERR] " : "[OK] ") + msg);
}

/* ---------------------------------------------------------------------- */
/* Adapter interface:                                                     */
/*   async listJsonPaths(prefix) -> [relPath, ...]                        */
/*   async readJson(relPath) -> object                                    */
/*   async writeJson(relPath, obj) -> void                                */
/*   async deleteJson(relPath) -> void                                    */
/* ---------------------------------------------------------------------- */


// Общая сортировка вариантов по русскому отображаемому тексту — иначе
// список из полусотни значений (например, "Цель эффекта" в конструкторе
// способностей) невозможно просмотреть глазами: "здоровье" зарыто где-то
// в середине неотсортированного английского порядка.
function sortByRuLabel(options) {
  return options.slice().sort((a, b) => ruLabel(a).localeCompare(ruLabel(b), "ru"));
}
