/**
 * Адаптеры источника данных — единый интерфейс поверх Google Диска
 * (File System Access API) и GitHub (REST API), см. README.
 *   listJsonPaths(prefix) -> [relPath, ...]
 *   readJson(relPath) -> object
 *   writeJson(relPath, obj) -> void
 *   deleteJson(relPath) -> void
 */
class LocalAdapter {
  constructor(dirHandle) { this.root = dirHandle; }

  async _walk(dirHandle, prefix, out) {
    for await (const [name, handle] of dirHandle.entries()) {
      const relPath = prefix ? prefix + "/" + name : name;
      if (handle.kind === "directory") {
        await this._walk(handle, relPath, out);
      } else if (name.endsWith(".json")) {
        out.push(relPath);
      }
    }
  }

  async listJsonPaths(prefix) {
    const parts = prefix.split("/").filter(Boolean);
    let dir = this.root;
    try {
      for (const p of parts) dir = await dir.getDirectoryHandle(p);
    } catch (e) {
      return [];
    }
    const out = [];
    await this._walk(dir, prefix, out);
    return out;
  }

  async _getFileHandle(relPath, create) {
    const parts = relPath.split("/").filter(Boolean);
    const fname = parts.pop();
    let dir = this.root;
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return dir.getFileHandle(fname, { create });
  }

  async readJson(relPath) {
    const fh = await this._getFileHandle(relPath, false);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text);
  }

  async writeJson(relPath, obj) {
    const fh = await this._getFileHandle(relPath, true);
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(obj, null, "\t"));
    await writable.close();
  }

  async deleteJson(relPath) {
    const parts = relPath.split("/").filter(Boolean);
    const fname = parts.pop();
    let dir = this.root;
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    await dir.removeEntry(fname);
  }
}

class GitHubAdapter {
  constructor(owner, repo, branch, token) {
    this.owner = owner; this.repo = repo; this.branch = branch || "main";
    this.token = token || "";
  }

  _headers() {
    const h = { "Accept": "application/vnd.github+json" };
    if (this.token) h["Authorization"] = "token " + this.token;
    return h;
  }

  async listJsonPaths(prefix) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`;
    const res = await fetch(url, { headers: this._headers() });
    if (!res.ok) throw new Error("GitHub tree API: " + res.status + " " + res.statusText);
    const data = await res.json();
    return data.tree
      .filter(n => n.type === "blob" && n.path.startsWith(prefix) && n.path.endsWith(".json"))
      .map(n => n.path);
  }

  async readJson(relPath) {
    const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${relPath}`;
    const res = await fetch(url, this.token ? { headers: { "Authorization": "token " + this.token } } : {});
    if (!res.ok) throw new Error("Не удалось прочитать " + relPath + " (" + res.status + ")");
    return res.json();
  }

  async _getSha(relPath) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${relPath}?ref=${this.branch}`;
    const res = await fetch(url, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("GitHub contents API: " + res.status);
    const data = await res.json();
    return data.sha;
  }

  async writeJson(relPath, obj) {
    if (!this.token) throw new Error("Нужен GitHub-токен, чтобы сохранять файлы.");
    const sha = await this._getSha(relPath);
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${relPath}`;
    const body = {
      message: (sha ? "Update " : "Create ") + relPath + " (Manifest Editor)",
      content: b64EncodeUnicode(JSON.stringify(obj, null, "\t")),
      branch: this.branch
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: "PUT", headers: { ...this._headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error("Не удалось сохранить: " + res.status + " " + errText);
    }
  }

  async deleteJson(relPath) {
    if (!this.token) throw new Error("Нужен GitHub-токен, чтобы удалять файлы.");
    const sha = await this._getSha(relPath);
    if (!sha) return;
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${relPath}`;
    const res = await fetch(url, {
      method: "DELETE", headers: { ...this._headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Delete " + relPath + " (Manifest Editor)", sha, branch: this.branch })
    });
    if (!res.ok) throw new Error("Не удалось удалить: " + res.status);
  }
}

/* ---------------------------------------------------------------------- */
/* Bootstrap: загрузка схем и словарей                                    */
/* ---------------------------------------------------------------------- */

async function loadSchemasAndVocab() {
  const schemaPaths = await STATE.adapter.listJsonPaths(PATHS.schemas);
  STATE.schemas = [];
  STATE.schemasById = {};
  for (const p of schemaPaths) {
    try {
      const data = await STATE.adapter.readJson(p);
      if (data && data.id) {
        STATE.schemas.push(data);
        STATE.schemasById[data.id] = data;
      }
    } catch (e) { console.warn("Схема не загружена:", p, e); }
  }
  STATE.schemas.sort((a, b) => {
    const oa = GROUP_ORDER.indexOf(a.group || "misc");
    const ob = GROUP_ORDER.indexOf(b.group || "misc");
    if (oa !== ob) return oa - ob;
    return (a.label || "").localeCompare(b.label || "");
  });

  const vocabPaths = await STATE.adapter.listJsonPaths(PATHS.vocab);
  STATE.vocab = {};
  for (const p of vocabPaths) {
    try {
      const key = p.split("/").pop().replace(".json", "");
      STATE.vocab[key] = await STATE.adapter.readJson(p);
    } catch (e) { console.warn("Словарь не загружен:", p, e); }
  }
}

async function loadAllManifests() {
  const allPaths = await STATE.adapter.listJsonPaths(PATHS.world + "/");
  const relevant = allPaths.filter(p =>
    !p.startsWith(PATHS.schemas) && !p.startsWith(PATHS.vocab));
  STATE.manifestIndex = [];
  for (const p of relevant) {
    try {
      const data = await STATE.adapter.readJson(p);
      if (data && typeof data === "object") {
        STATE.manifestIndex.push({ path: p, data });
      }
    } catch (e) { console.warn("Манифест не загружен:", p, e); }
  }
}

/* ---------------------------------------------------------------------- */
/* Уникальность ID.                                                       */
/* Решение: ID уникален ГЛОБАЛЬНО по всему проекту, а не в рамках         */
/* категории (меч и щит НЕ могут иметь одинаковый ID "0001"). Так проще   */
/* ссылаться на любой объект из любого другого места (quest_id, from_id/  */
/* to_id связей, loot_table и т.д.) без указания типа — а с сотнями       */
/* manifest-типов в этом проекте отслеживать уникальность "в рамках       */
/* каждой из 32 категорий отдельно" гораздо легче перепутать, чем         */
/* просто держать один общий пул ID.                                     */
/* ---------------------------------------------------------------------- */

