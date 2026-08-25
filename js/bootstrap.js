/**
 * Загрузка схем/словарей/манифестов через активный адаптер, проверка
 * глобальной уникальности ID (см. IdValidator в tools/sheets-sync и
 * обоснование в README — единый пул ID по всему проекту), навигация между
 * тремя страницами приложения.
 */
function findIdConflict(id, excludePath) {
  if (!id) return null;
  return STATE.manifestIndex.find(m => m.data.id === id && m.path !== excludePath) || null;
}

/* ---------------------------------------------------------------------- */
/* Навигация между двумя страницами                                       */
/* ---------------------------------------------------------------------- */

function switchPage(page) {
  STATE.currentPage = page;
  document.getElementById("editorPage").classList.toggle("active", page === "editor");
  document.getElementById("databasePage").classList.toggle("active", page === "database");
  document.getElementById("dashboardPage").classList.toggle("active", page === "dashboard");
  document.getElementById("navEditorBtn").classList.toggle("active", page === "editor");
  document.getElementById("navDatabaseBtn").classList.toggle("active", page === "database");
  document.getElementById("navDashboardBtn").classList.toggle("active", page === "dashboard");
}

function populateCategorySelect() {
  const select = document.getElementById("categorySelect");
  select.innerHTML = "";
  select.appendChild(el("option", { value: "", text: "— выберите тип объекта —" }));

  let currentGroup = null;
  let optgroup = null;
  for (const schema of STATE.schemas) {
    const group = schema.group || "misc";
    if (group !== currentGroup) {
      currentGroup = group;
      optgroup = el("optgroup", { label: GROUP_LABELS[group] || group });
      select.appendChild(optgroup);
    }
    const count = STATE.manifestIndex.filter(m => m.data.type === schema.id).length;
    optgroup.appendChild(el("option", {
      value: schema.id,
      text: `${schema.icon || "📦"} ${schema.label || schema.id} (${count})`
    }));
  }

  select.addEventListener("change", () => {
    if (select.value) showCategoryView(select.value);
    else document.getElementById("categoryBody").innerHTML = "";
  });
}

/* ---------------------------------------------------------------------- */
/* Database / Search page                                                 */
/* ---------------------------------------------------------------------- */

