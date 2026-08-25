/**
 * Диалог настроек источника данных + инициализация приложения.
 */
const LS_KEY = "rpg_manifest_editor_settings_v1";

function loadSavedSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch (e) { return {}; }
}
function saveSettings(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

async function activateAdapter(adapter, label) {
  const editorBody = document.getElementById("categoryBody");
  editorBody.innerHTML = "<p style='color:var(--text-dim)'>⏳ Загружаю схемы и манифесты...</p>";
  try {
    STATE.adapter = adapter;
    STATE.sourceLabel = label;
    document.getElementById("srcBadge").textContent = "источник: " + label;
    await loadSchemasAndVocab();
    await loadAllManifests();
    populateCategorySelect();
    editorBody.innerHTML = "";
    renderDatabasePage();
    document.getElementById("settingsModal").classList.add("hidden");
    toast(`Загружено: ${STATE.schemas.length} схем, ${STATE.manifestIndex.length} манифестов.`);
  } catch (e) {
    editorBody.innerHTML = `<p style="color:var(--danger)">❌ Не удалось загрузить данные: ${e.message}<br><br>
      Проверь пути (${PATHS.schemas}, ${PATHS.vocab}, ${PATHS.world}) относительно выбранного корня,
      и что источник действительно доступен (CORS/https/токен).</p>`;
  }
}

function setupSettingsModal() {
  const modal = document.getElementById("settingsModal");
  document.getElementById("settingsBtn").addEventListener("click", () => modal.classList.remove("hidden"));
  document.getElementById("closeSettingsBtn").addEventListener("click", () => modal.classList.add("hidden"));

  const tabLocalBtn = document.getElementById("tabLocalBtn");
  const tabGithubBtn = document.getElementById("tabGithubBtn");
  const tabLocal = document.getElementById("tabLocal");
  const tabGithub = document.getElementById("tabGithub");
  tabLocalBtn.addEventListener("click", () => {
    tabLocalBtn.classList.add("active"); tabGithubBtn.classList.remove("active");
    tabLocal.style.display = ""; tabGithub.style.display = "none";
  });
  tabGithubBtn.addEventListener("click", () => {
    tabGithubBtn.classList.add("active"); tabLocalBtn.classList.remove("active");
    tabGithub.style.display = ""; tabLocal.style.display = "none";
  });

  document.getElementById("pickFolderBtn").addEventListener("click", async () => {
    const statusEl = document.getElementById("localStatus");
    if (!window.showDirectoryPicker) {
      statusEl.textContent = "❌ Браузер не поддерживает File System Access API (нужен Chrome/Edge/Opera по https или localhost).";
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      statusEl.textContent = "⏳ Проверяю структуру папки...";
      await activateAdapter(new LocalAdapter(dirHandle), "📁 " + dirHandle.name + " (локально)");
    } catch (e) {
      if (e.name !== "AbortError") statusEl.textContent = "❌ " + e.message;
    }
  });

  const saved = loadSavedSettings();
  if (saved.ghOwner) document.getElementById("ghOwner").value = saved.ghOwner;
  if (saved.ghRepo) document.getElementById("ghRepo").value = saved.ghRepo;
  if (saved.ghBranch) document.getElementById("ghBranch").value = saved.ghBranch;
  if (saved.ghToken) document.getElementById("ghToken").value = saved.ghToken;

  document.getElementById("connectGithubBtn").addEventListener("click", async () => {
    const owner = document.getElementById("ghOwner").value.trim();
    const repo = document.getElementById("ghRepo").value.trim();
    const branch = document.getElementById("ghBranch").value.trim() || "main";
    const token = document.getElementById("ghToken").value.trim();
    const statusEl = document.getElementById("githubStatus");
    if (!owner || !repo) { statusEl.textContent = "⚠️ Укажи владельца и репозиторий."; return; }
    saveSettings({ ghOwner: owner, ghRepo: repo, ghBranch: branch, ghToken: token });
    statusEl.textContent = "⏳ Подключаюсь...";
    await activateAdapter(new GitHubAdapter(owner, repo, branch, token), `🐙 ${owner}/${repo}@${branch}`);
  });
}

function checkFileProtocol() {
  if (location.protocol === "file:") {
    const banner = document.getElementById("fileWarning");
    banner.style.display = "block";
    banner.classList.add("show");
  }
}

function setupTopNav() {
  document.getElementById("navEditorBtn").addEventListener("click", () => switchPage("editor"));
  document.getElementById("navDatabaseBtn").addEventListener("click", () => { switchPage("database"); renderDatabasePage(); });
  document.getElementById("navDashboardBtn").addEventListener("click", () => { switchPage("dashboard"); renderDashboardPage(); });
}

window.addEventListener("DOMContentLoaded", () => {
  checkFileProtocol();
  setupTopNav();
  setupSettingsModal();
  document.getElementById("settingsModal").classList.remove("hidden");
});
