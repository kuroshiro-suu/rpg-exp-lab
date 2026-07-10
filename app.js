"use strict";

const STORAGE_KEY = "rpg_exp_lab_settings_v1";

const DEFAULT_SETTINGS = {
  gameName: "灰の門の迷宮",
  maxLevel: 99,
  baseExp: 40,
  growthRate: 1.12,
  plusCoef: 5,
  growthStopLevel: 50,
  plusStopLevel: 50,
  roundUnit: 10,
  stageCount: 7,
  stages: [
    { startLevel: 1, battles: 40 },
    { startLevel: 7, battles: 50 },
    { startLevel: 14, battles: 60 },
    { startLevel: 21, battles: 70 },
    { startLevel: 28, battles: 80 },
    { startLevel: 35, battles: 90 },
    { startLevel: 42, battles: 100 }
  ]
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
  saveButton: document.getElementById("saveButton"),
  loadButton: document.getElementById("loadButton"),
  resetButton: document.getElementById("resetButton"),
  copyCsvButton: document.getElementById("copyCsvButton"),

  stageInputs: document.getElementById("stageInputs"),
  stageSummary: document.getElementById("stageSummary"),
  levelList: document.getElementById("levelList"),
  message: document.getElementById("message")
};

let lastResult = null;

document.addEventListener("DOMContentLoaded", () => {
  loadSettings(false);
  calculateAndRender();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
});

els.makeStagesButton.addEventListener("click", () => {
  const settings = readSettingsFromForm();
  renderStageInputs(settings);
  setMessage("ステージ欄を作成しました。");
});

els.calcButton.addEventListener("click", () => {
  calculateAndRender();
  setMessage("計算しました。");
});

els.saveButton.addEventListener("click", () => {
  saveSettings();
});

els.loadButton.addEventListener("click", () => {
  loadSettings(true);
  calculateAndRender();
});

els.resetButton.addEventListener("click", () => {
  if (!confirm("初期値に戻しますか？")) return;
  applySettings(DEFAULT_SETTINGS);
  calculateAndRender();
  setMessage("初期値に戻しました。");
});

els.copyCsvButton.addEventListener("click", async () => {
  if (!lastResult) {
    calculateAndRender();
  }

  const csv = buildCsv(lastResult);

  try {
    await navigator.clipboard.writeText(csv);
    setMessage("CSVをコピーしました。");
  } catch {
    setMessage("コピーに失敗しました。");
  }
});

function readSettingsFromForm() {
  const stageCount = clamp(toInt(els.stageCount.value, 7), 1, 30);

  const stages = [];

  for (let i = 1; i <= stageCount; i++) {
    const startInput = document.getElementById(`stageStart_${i}`);
    const battlesInput = document.getElementById(`stageBattles_${i}`);

    const fallbackStart = i === 1 ? 1 : 1 + (i - 1) * 7;

    stages.push({
      startLevel: toInt(startInput?.value, fallbackStart),
      battles: toInt(battlesInput?.value, 40 + (i - 1) * 10)
    });
  }

  return {
    gameName: els.gameName.value.trim() || "無題",
    maxLevel: clamp(toInt(els.maxLevel.value, 99), 2, 999),
    baseExp: Math.max(1, toInt(els.baseExp.value, 40)),
    growthRate: Math.max(0, toFloat(els.growthRate.value, 1.12)),
    plusCoef: toFloat(els.plusCoef.value, 5),
    growthStopLevel: clamp(toInt(els.growthStopLevel.value, 50), 1, 999),
    plusStopLevel: clamp(toInt(els.plusStopLevel.value, 50), 1, 999),
    roundUnit: Math.max(1, toInt(els.roundUnit.value, 10)),
    stageCount,
    stages
  };
}

function applySettings(settings) {
  els.gameName.value = settings.gameName;
  els.maxLevel.value = settings.maxLevel;
  els.baseExp.value = settings.baseExp;
  els.growthRate.value = settings.growthRate;
  els.plusCoef.value = settings.plusCoef;
  els.growthStopLevel.value = settings.growthStopLevel;
  els.plusStopLevel.value = settings.plusStopLevel;
  els.roundUnit.value = settings.roundUnit;
  els.stageCount.value = settings.stageCount;

  renderStageInputs(settings);
}

function renderStageInputs(settings) {
  els.stageInputs.innerHTML = "";

  const stageCount = clamp(toInt(settings.stageCount, 7), 1, 30);

  for (let i = 1; i <= stageCount; i++) {
    const stage = settings.stages[i - 1] || {
      startLevel: i === 1 ? 1 : 1 + (i - 1) * 7,
      battles: 40 + (i - 1) * 10
    };

    const card = document.createElement("div");
    card.className = "stageInputCard";

    card.innerHTML = `
      <div class="stageInputTitle">ステージ${i}</div>
      <div class="grid2">
        <label>
          <span>開始Lv</span>
          <input id="stageStart_${i}" type="number" value="${stage.startLevel}" min="1" />
        </label>
        <label>
          <span>戦闘数</span>
          <input id="stageBattles_${i}" type="number" value="${stage.battles}" min="0" />
        </label>
      </div>
    `;

    els.stageInputs.appendChild(card);
  }
}

function calculateAndRender() {
  const settings = readSettingsFromForm();

  const levels = buildLevelTable(settings);
  const stages = buildStageSummary(settings, levels);

  lastResult = {
    settings,
    levels,
    stages
  };

  renderStageSummary(stages);
  renderLevelList(levels);
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
      startLevel: Math.max(1, toInt(stage.startLevel, 1)),
      battles: Math.max(0, toInt(stage.battles, 0))
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
  els.levelList.innerHTML = "";

  for (const row of levels) {
    const div = document.createElement("div");
    div.className = "levelRow";

    div.innerHTML = `
      <span class="lv">Lv${row.lv}</span>
      <span class="num">次${row.nextExp === null ? "--" : formatNumber(row.nextExp)}</span>
      <span class="num">累${formatNumber(row.cumulative)}</span>
      <span class="stage">St${row.stageNo}</span>
    `;

    els.levelList.appendChild(div);
  }
}

function saveSettings() {
  const settings = readSettingsFromForm();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage(`保存しました：${settings.gameName}`);
  } catch {
    setMessage("保存に失敗しました。");
  }
}

function loadSettings(showMessage) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const settings = raw ? JSON.parse(raw) : DEFAULT_SETTINGS;

    applySettings(settings);

    if (showMessage) {
      setMessage(`ロードしました：${settings.gameName}`);
    }
  } catch {
    applySettings(DEFAULT_SETTINGS);
    if (showMessage) {
      setMessage("ロードに失敗したため、初期値を表示しました。");
    }
  }
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

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return Number(value).toLocaleString("ja-JP");
}

function setMessage(text) {
  els.message.textContent = text;
}
