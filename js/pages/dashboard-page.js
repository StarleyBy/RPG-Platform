/**
 * Дашборд — сводка по категориям + детектор битых ссылок.
 *
 * "Битая ссылка" = значение поля manifest_ref/manifest_multiref, которое
 * указывает на ID, которого нет ни в одном загруженном манифесте. Это
 * может случиться двумя способами: удалили манифест, на который кто-то
 * ссылался, или поле было заполнено до того, как целевой манифест вообще
 * появился (устаревшие данные из предыдущей версии поля — например, когда
 * class_restrictions было tags-полем со свободным текстом).
 */

function _collectRefFieldDefs_(schema) {
  const out = [];
  for (const fdef of schema.base_fields) {
    if (fdef.type === "manifest_ref" || fdef.type === "manifest_multiref") {
      out.push({ sectionKey: null, fdef });
    }
  }
  for (const section of schema.sections) {
    for (const fdef of section.fields) {
      if (fdef.type === "manifest_ref" || fdef.type === "manifest_multiref") {
        out.push({ sectionKey: section.key, fdef });
      }
    }
  }
  return out;
}

function findDanglingReferences() {
  const existingIds = new Set(STATE.manifestIndex.map(m => m.data.id));
  const issues = [];

  for (const m of STATE.manifestIndex) {
    const schema = STATE.schemasById[m.data.type];
    if (!schema) continue;
    const refFields = _collectRefFieldDefs_(schema);
    if (!refFields.length) continue;

    for (const rf of refFields) {
      let container = m.data;
      if (rf.sectionKey) {
        container = m.data[rf.sectionKey];
        if (!container || !container.enabled) continue;
      }
      const raw = container ? container[rf.fdef.key] : undefined;
      if (raw === undefined || raw === null || raw === "") continue;

      const ids = Array.isArray(raw) ? raw : [raw];
      for (const refId of ids) {
        if (!refId) continue;
        if (!existingIds.has(refId)) {
          issues.push({
            fromManifest: m, fieldLabel: rf.fdef.label || rf.fdef.key, missingId: refId
          });
        }
      }
    }
  }
  return issues;
}

function renderDashboardPage() {
  const page = document.getElementById("dashboardPage");
  page.innerHTML = "";

  page.appendChild(el("div", { class: "cat-header" }, [
    el("div", {}, [
      el("h2", { text: "🧭 Дашборд" }),
      el("p", { class: "desc", text: "Сводка по категориям и проверка целостности перекрёстных ссылок между манифестами." })
    ])
  ]));

  const grid = el("div", { class: "dash-grid" });
  for (const schema of STATE.schemas) {
    const count = STATE.manifestIndex.filter(m => m.data.type === schema.id).length;
    const card = el("div", {
      class: "dash-card", style: `--dot:${schema.color}`,
      onclick: () => {
        switchPage("editor");
        document.getElementById("categorySelect").value = schema.id;
        showCategoryView(schema.id);
      }
    }, [
      el("h3", { text: `${schema.icon || "📦"} ${schema.label}` }),
      el("div", { class: "dash-count", text: String(count) }),
      el("div", { class: "dash-sub", text: GROUP_LABELS[schema.group] || schema.group })
    ]);
    grid.appendChild(card);
  }
  page.appendChild(grid);

  const issuesHost = el("div", { class: "dash-issues" });
  const issues = findDanglingReferences();
  issuesHost.appendChild(el("h3", { text: `⚠️ Проверка ссылок (${issues.length})` }));

  if (issues.length === 0) {
    issuesHost.appendChild(el("div", {
      class: "dash-ok-banner",
      text: "✅ Все перекрёстные ссылки (manifest_ref / manifest_multiref) указывают на существующие манифесты."
    }));
  } else {
    for (const issue of issues) {
      const schema = STATE.schemasById[issue.fromManifest.data.type];
      issuesHost.appendChild(el("div", {
        class: "dash-issue-row",
        onclick: () => openManifestInEditor(issue.fromManifest)
      }, [
        el("span", { text: `${schema ? schema.icon : "📦"} "${issue.fromManifest.data.name || issue.fromManifest.data.id}"` }),
        el("span", { style: "color:var(--text-dim)", text: `→ поле "${issue.fieldLabel}" ссылается на несуществующий ID:` }),
        el("span", { style: "font-family:var(--mono);color:var(--danger)", text: issue.missingId })
      ]));
    }
  }
  page.appendChild(issuesHost);
}
