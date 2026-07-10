"use strict";

const STORAGE_KEY = "rpg_exp_lab_save_slots_v2";

const SAMPLE_SETTINGS = {
  gameName: "灰の門の迷宮",
  maxLevel: 99,
  baseExp: 40,
  growthRate: 1.12,
  plusCoef: 5,
  growthStopLevel: 50,
  plusStopLevel: 75,
  roundUnit: 10,
  stageCount: 7,
  stages: [
    { startLevel: 1, battles: 40 },
    { startLevel: 7, battles: 45 },
    { startLevel: 14, battles: 50 },
    { startLevel: 21, battles: 55 },
    { startLevel: 28, battles: 60 },
    { startLevel: 35, battles: 65 },
    { startLevel: 42, battles: 70 }
  ]
};

const EMPTY_SETTINGS = {
  gameName: "",
  maxLevel: "",
  baseExp: "",
  growthRate: "",
  plusCoef: "",
  growthStopLevel: "",
  plusStopLevel: "",
  roundUnit: "",
  stageCount: "",
  stages: []
};

const els = {
  gameName: document.getElementById("gameName"),
  maxLevel: document.getElementById("maxLevel"),
  baseExp: document.getElementById("baseExp"),
  growthRate: document.getElementById("growthRate"),
  plusCoef: document.getElementById("plusCoef"),
  growthStopLevel: document.getElementById("growthStopLevel"),
  plusStopLevel: document.getElementById("plusStopLevel"),
  roundUnit: document.getElementById("roundUnit"),
  stageCount: document.getElementById("stageCount"),

  makeStagesButton: document.getElementById("makeStagesButton"),
  calcButton: document.getElementById("calcButton"),
  copyCsvButton: document.getElementById("copyCsvButton"),
  saveButton: document.getElementById("saveButton"),
  saveListButton: document.getElementById("saveListButton"),
  sampleButton: document.getElementById("sampleButton"),
  clearButton: document.getElementById("clearButton"),

  stageInputs: document.getElementById("stageInputs"),
  stageSummary: document.getElementById("stageSummary"),
  levelList: document.getElementById("levelList"),
  saveList: document.getElementById("saveList"),
  message: document.getElementById("message")
};

let lastResult = null;
let hasCalculated = false;

document.addEventListener("DOMContentLoaded", () => {
  applySettings(EMPTY_SETTINGS);
  clearResults();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
});

els.makeStagesButton.addEventListener("click", () => {
  const settings = readSettingsFromForm(false);
  renderStageInputs(settings);
  setMessage("ステージ欄を作成しました。");
});

els.calcButton.addEventListener("click", () => {
  calculateAndRender();
});

els.copyCsvButton.addEventListener("click", async () => {
  if (!lastResult) {
    calculateAndRender();
  }

  if (!lastResult) return;

  const csv = buildCsv(lastResult);

  try {
    await navigator.clipboard.writeText(csv);
    setMessage("CSVをコピーしました。");
  } catch {
    setMessage("コピーに失敗しました。");
  }
});

els.saveButton.addEventListener("click", () => {
  saveCurrentSettings();
});

els.saveListButton.addEventListener("click", () => {
  toggleSaveList();
});

els.sampleButton.addEventListener("click", () => {
  applySettings(SAMPLE_SETTINGS);
  clearResults();
  setMessage("サンプルを読み込みました。計算を押してください。");
});

els.clearButton.addEventListener("click", () => {
  if (!confirm("入力内容と計算結果をすべて空欄に戻します。よろしいですか？")) {
    return;
  }

  applySettings(EMPTY_SETTINGS);
  clearResults();
  setMessage("初期化しました。");
});

function readSettingsFromForm(strict) {
  const stageCount = toIntOrNull(els.stageCount.value);

  const settings = {
    gameName: els.gameName.value.trim(),
    maxLevel: toIntOrNull(els.maxLevel.value),
    baseExp: toIntOrNull(els.baseExp.value),
    growthRate: toFloatOrNull(els.growthRate.value),
    plusCoef: toFloatOrNull(els.plusCoef.value),
    growthStopLevel: toIntOrNull(els.growthStopLevel.value),
    plusStopLevel: toIntOrNull(els.plusStopLevel.value),
    roundUnit: toIntOrNull(els.roundUnit.value),
    stageCount: stageCount,
    stages: []
  };

  const count = clamp(stageCount || 0, 0, 30);

  for (let i = 1; i <= count; i++) {
    const startInput = document.getElementById(`stageStart_${i}`);
    const battlesInput = document.getElementById(`stageBattles_${i}`);

    settings.stages.push({
      startLevel: toIntOrNull(startInput?.value),
      battles: toIntOrNull(battlesInput?.value)
    });
  }

  if (strict) {
    validateSettings(settings);
  }

  return settings;
}

function validateSettings(settings) {
  const errors = [];

  if (!settings.gameName) errors.push("ゲーム名");
  if (!settings.maxLevel || settings.maxLevel < 2) errors.push("最大Lv");
  if (!settings.baseExp || settings.baseExp < 1) errors.push("Lv1→2必要EXP");
  if (!settings.growthRate || settings.growthRate < 0) errors.push("必要EXP増加率");
  if (settings.plusCoef === null || settings.plusCoef === undefined) errors.push("プラス係数");
  if (!settings.growthStopLevel || settings.growthStopLevel < 1) errors.push("増加率停止Lv");
  if (!settings.plusStopLevel || settings.plusStopLevel < 1) errors.push("プラス係数停止Lv");
  if (!settings.roundUnit || settings.roundUnit < 1) errors.push("丸め単位");
  if (!settings.stageCount || settings.stageCount < 1) errors.push("ステージ数");

  for (let i = 0; i < (settings.stages || []).length; i++) {
    const stage = settings.stages[i];
    if (!stage.startLevel || stage.startLevel < 1) {
      errors.push(`ステージ${i + 1}開始Lv`);
    }
    if (stage.battles === null || stage.battles === undefined || stage.battles < 0) {
      errors.push(`ステージ${i + 1}戦闘数`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`未入力または不正な項目があります：${errors.join("、")}`);
  }
}

function applySettings(settings) {
  els.gameName.value = settings.gameName ?? "";
  els.maxLevel.value = settings.maxLevel ?? "";
  els.baseExp.value = settings.baseExp ?? "";
  els.growthRate.value = settings.growthRate ?? "";
  els.plusCoef.value = settings.plusCoef ?? "";
  els.growthStopLevel.value = settings.growthStopLevel ?? "";
  els.plusStopLevel.value = settings.plusStopLevel ?? "";
  els.roundUnit.value = settings.roundUnit ?? "";
  els.stageCount.value = settings.stageCount ?? "";

  renderStageInputs(settings);
}

function renderStageInputs(settings) {
  els.stageInputs.innerHTML = "";

  const stageCount = clamp(toIntOrNull(settings.stageCount) || 0, 0, 30);

  if (stageCount <= 0) {
    els.stageInputs.classList.add("emptyText");
    els.stageInputs.textContent = "ステージ数を入力して「ステージ欄を作成」を押してください。";
    return;
  }

  els.stageInputs.classList.remove("emptyText");

  for (let i = 1; i <= stageCount; i++) {
    const stage = settings.stages?.[i - 1] || {
      startLevel: "",
      battles: ""
    };

    const card = document.createElement("div");
    card.className = "stageInputCard";

    card.innerHTML = `
      <div class="stageInputTitle">ステージ${i}</div>
      <div class="grid2">
        <label>
          <span>開始Lv</span>
          <input id="stageStart_${i}" type="number" value="${stage.startLevel ?? ""}" min="1" placeholder="${i === 1 ? "1" : ""}" />
        </label>
        <label>
          <span>戦闘数</span>
          <input id="stageBattles_${i}" type="number" value="${stage.battles ?? ""}" min="0" placeholder="${40 + (i - 1) * 5}" />
        </label>
      </div>
    `;

    els.stageInputs.appendChild(card);
  }
}

function calculateAndRender() {
  try {
    const settings = readSettingsFromForm(true);

    const levels = buildLevelTable(settings);
    const stages = buildStageSummary(settings, levels);

    lastResult = {
      settings,
      levels,
      stages
    };

    renderStageSummary(stages);
    renderLevelList(levels);

    hasCalculated = true;
    els.calcButton.textContent = "再計算";

    setMessage("計算しました。");
  } catch (error) {
    setMessage(error.message);
  }
}

function buildLevelTable(settings) {
  const levels = [];
  let nextExp = settings.baseExp;
  let cumulative = 0;

  const sortedStages = normalizeStages(settings);

  for (let lv = 1; lv <= settings.maxLevel; lv++) {
    const stageNo = findStageNo(lv, sortedStages);

    levels.push({
      lv,
      nextExp: lv === settings.maxLevel ? null : nextExp,
      cumulative,
      stageNo
    });

    if (lv < settings.maxLevel) {
      cumulative += nextExp;

      const effectiveRate =
        lv >= settings.growthStopLevel ? 1 : settings.growthRate;

      const effectivePlus =
        lv >= settings.plusStopLevel ? 0 : settings.plusCoef;

      const rawNext = nextExp * effectiveRate + lv * effectivePlus;
      nextExp = roundTo(rawNext, settings.roundUnit);
      nextExp = Math.max(1, nextExp);
    }
  }

  return levels;
}

function normalizeStages(settings) {
  const stages = settings.stages
    .map((stage, index) => ({
      no: index + 1,
      startLevel: Math.max(1, toIntOrNull(stage.startLevel) || 1),
      battles: Math.max(0, toIntOrNull(stage.battles) || 0)
    }))
    .sort((a, b) => a.startLevel - b.startLevel);

  if (stages.length === 0 || stages[0].startLevel !== 1) {
    stages.unshift({
      no: 1,
      startLevel: 1,
      battles: 0
    });
  }

  return stages;
}

function findStageNo(lv, stages) {
  let current = stages[0]?.no || 1;

  for (const stage of stages) {
    if (lv >= stage.startLevel) {
      current = stage.no;
    } else {
      break;
    }
  }

  return current;
}

function buildStageSummary(settings, levels) {
  const stages = normalizeStages(settings);
  const result = [];

  for (let i = 0; i < stages.length; i++) {
    const current = stages[i];
    const next = stages[i + 1];

    const startLv = current.startLevel;
    const endLv = next ? next.startLevel - 1 : settings.maxLevel;

    const targetLevels = levels.filter(
      row => row.lv >= startLv && row.lv <= endLv && row.nextExp !== null
    );

    const totalExp = targetLevels.reduce(
      (sum, row) => sum + (row.nextExp || 0),
      0
    );

    const perBattle =
      current.battles > 0 ? Math.round(totalExp / current.battles) : 0;

    result.push({
      no: current.no,
      startLv,
      endLv,
      battles: current.battles,
      totalExp,
      perBattle
    });
  }

  return result;
}

function renderStageSummary(stages) {
  els.stageSummary.classList.remove("emptyText");
  els.stageSummary.innerHTML = "";

  for (const stage of stages) {
    const card = document.createElement("div");
    card.className = "stageCard";

    card.innerHTML = `
      <div class="stageHeader">
        <div class="stageName">ステージ${stage.no}</div>
        <div class="stageRange">Lv${stage.startLv}〜${stage.endLv} / ${stage.battles}戦</div>
      </div>

      <div>
        <div class="miniLabel">1戦EXP目安</div>
        <div class="stageBig">${formatNumber(stage.perBattle)}</div>
      </div>

      <div class="stageSmallGrid">
        <div>
          <div class="miniLabel">必要EXP合計</div>
          <div class="miniValue">${formatNumber(stage.totalExp)}</div>
        </div>
        <div>
          <div class="miniLabel">戦闘数</div>
          <div class="miniValue">${formatNumber(stage.battles)}</div>
        </div>
      </div>
    `;

    els.stageSummary.appendChild(card);
  }
}

function renderLevelList(levels) {
  els.levelList.classList.remove("emptyText");
  els.levelList.innerHTML = "";

  for (const row of levels) {
    const div = document.createElement("div");
    div.className = "levelRow";

    div.innerHTML = `
      <span class="lv">Lv${row.lv}</span>
      <span class="num">${row.nextExp === null ? "--" : formatNumber(row.nextExp)}</span>
      <span class="num">${formatNumber(row.cumulative)}</span>
      <span class="stage">${row.stageNo}</span>
    `;

    els.levelList.appendChild(div);
  }
}

function clearResults() {
  lastResult = null;
  hasCalculated = false;
  els.calcButton.textContent = "計算";

  els.stageSummary.classList.add("emptyText");
  els.stageSummary.textContent = "計算すると、ステージごとの1戦EXP目安が表示されます。";

  els.levelList.classList.add("emptyText");
  els.levelList.textContent = "計算すると、Lvごとの必要EXPが表示されます。";

  els.saveList.classList.add("hidden");
  els.saveList.innerHTML = "";
}

function saveCurrentSettings() {
  try {
    const settings = readSettingsFromForm(true);
    const saves = loadAllSaves();

    const id = makeSaveId(settings.gameName);
    const now = new Date();

    saves[id] = {
      id,
      name: settings.gameName,
      savedAt: now.toISOString(),
      settings
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    setMessage(`端末に保存しました：${settings.gameName}`);
    renderSaveList();
  } catch (error) {
    setMessage(error.message);
  }
}

function toggleSaveList() {
  if (els.saveList.classList.contains("hidden")) {
    renderSaveList();
    els.saveList.classList.remove("hidden");
  } else {
    els.saveList.classList.add("hidden");
  }
}

function renderSaveList() {
  const saves = loadAllSaves();
  const entries = Object.values(saves).sort((a, b) =>
    String(b.savedAt).localeCompare(String(a.savedAt))
  );

  els.saveList.innerHTML = "";

  if (entries.length === 0) {
    els.saveList.innerHTML = `<div class="emptyText">保存データはまだありません。</div>`;
    return;
  }

  for (const item of entries) {
    const div = document.createElement("div");
    div.className = "saveItem";

    div.innerHTML = `
      <div class="saveTitle">${escapeHtml(item.name)}</div>
      <div class="saveMeta">保存日時：${formatDateTime(item.savedAt)}</div>
      <div class="saveButtons">
        <button data-load-id="${escapeHtml(item.id)}">読込</button>
        <button data-delete-id="${escapeHtml(item.id)}" class="dangerButton">削除</button>
      </div>
    `;

    els.saveList.appendChild(div);
  }

  els.saveList.querySelectorAll("[data-load-id]").forEach(button => {
    button.addEventListener("click", () => {
      loadSave(button.dataset.loadId);
    });
  });

  els.saveList.querySelectorAll("[data-delete-id]").forEach(button => {
    button.addEventListener("click", () => {
      deleteSave(button.dataset.deleteId);
    });
  });
}

function loadSave(id) {
  const saves = loadAllSaves();
  const item = saves[id];

  if (!item) {
    setMessage("保存データが見つかりません。");
    return;
  }

  applySettings(item.settings);
  clearResults();
  setMessage(`読み込みました：${item.name}`);
}

function deleteSave(id) {
  const saves = loadAllSaves();
  const item = saves[id];

  if (!item) return;

  if (!confirm(`「${item.name}」を削除しますか？`)) {
    return;
  }

  delete saves[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  renderSaveList();
  setMessage(`削除しました：${item.name}`);
}

function loadAllSaves() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function makeSaveId(name) {
  const safeName = String(name || "untitled")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return safeName || "untitled";
}

function buildCsv(result) {
  const lines = [];

  lines.push(`ゲーム名,${escapeCsv(result.settings.gameName)}`);
  lines.push("");
  lines.push("ステージ別まとめ");
  lines.push("ステージ,Lv帯,戦闘数,必要EXP合計,1戦EXP目安");

  for (const stage of result.stages) {
    lines.push([
      `ステージ${stage.no}`,
      `Lv${stage.startLv}-${stage.endLv}`,
      stage.battles,
      stage.totalExp,
      stage.perBattle
    ].map(escapeCsv).join(","));
  }

  lines.push("");
  lines.push("Lv詳細");
  lines.push("Lv,次Lv必要EXP,累計EXP,想定ステージ");

  for (const row of result.levels) {
    lines.push([
      row.lv,
      row.nextExp === null ? "" : row.nextExp,
      row.cumulative,
      row.stageNo
    ].map(escapeCsv).join(","));
  }

  return lines.join("\n");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function roundTo(value, unit) {
  return Math.round(value / unit) * unit;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return Number(value).toLocaleString("ja-JP");
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${y}/${m}/${day} ${h}:${min}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(text) {
  els.message.textContent = text;
}
