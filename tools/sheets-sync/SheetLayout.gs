/**
 * ЕДИНАЯ логика раскладки колонок листа — используется и SheetBuilder
 * (что писать в шапку), и Exporter (как читать строку обратно). Если бы
 * эти два места считали колонки по-разному, лист рано или поздно "поехал"
 * бы. Колонки различаются по стабильному colKey (хранится в заметке
 * (Note) на ячейке шапки), а не по порядковому номеру — поэтому изменение
 * порядка полей в схеме не ломает уже заполненные строки листа.
 *
 * colKey:
 *   "id"                              — колонка ID (всегда колонка B)
 *   "<fieldKey>"                      — обычное базовое поле
 *   "<sectionKey>.__enabled__"        — чекбокс "включить секцию"
 *   "<sectionKey>.<fieldKey>"         — поле внутри секции
 */

function computeColumns(schema) {
  var cols = [];

  cols.push({ colKey: "id", header: "ID", kind: "id", fdef: null, sectionKey: null });

  for (var i = 0; i < schema.base_fields.length; i++) {
    var fdef = schema.base_fields[i];
    if (fdef.key === "id") continue;
    cols.push({ colKey: fdef.key, header: fdef.label || fdef.key, kind: fdef.type, fdef: fdef, sectionKey: null });
  }

  for (var s = 0; s < schema.sections.length; s++) {
    var section = schema.sections[s];
    cols.push({
      colKey: section.key + ".__enabled__",
      header: "✅ " + (section.toggle_label || section.key),
      kind: "section_toggle", fdef: null, sectionKey: section.key
    });
    for (var j = 0; j < section.fields.length; j++) {
      var sfdef = section.fields[j];
      cols.push({
        colKey: section.key + "." + sfdef.key,
        header: sfdef.label || sfdef.key,
        kind: sfdef.type, fdef: sfdef, sectionKey: section.key
      });
    }
  }

  return cols;
}

function sheetTabName(schema) {
  var name = (schema.icon || "") + " " + schema.label;
  // Ограничение Google Sheets на имя листа — 100 символов.
  return name.length > 95 ? name.slice(0, 95) : name;
}
