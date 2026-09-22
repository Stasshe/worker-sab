import { configurations, IMAGE_HEIGHT, IMAGE_WIDTH, renderRow } from "./fractal.js";
import "./style.css";
import { createWasmRenderer } from "./wasm.js";

const workerUrl = new URL("./worker.js", import.meta.url);
const messageTileWorkerUrl = new URL("./tile-message.worker.js", import.meta.url);
const sabTileWorkerUrl = new URL("./tile-sab.worker.js", import.meta.url);
const coreCount = navigator.hardwareConcurrency || 4;
const workerCount = Math.max(1, Math.min(coreCount - 1, 8));
const paths = ["main", "wasm", "worker", "worker-wasm"];
const communicationCases = [
  { id: "fine", tileWidth: 2, tileHeight: 2, tileCount: 144_000 },
];

const elements = {
  workload: document.querySelector("#workload"),
  workloadLabel: document.querySelector("#workload-label"),
  runAll: document.querySelector("#run-all"),
  runMain: document.querySelector("#run-main"),
  runWorker: document.querySelector("#run-worker"),
  runWasm: document.querySelector("#run-wasm"),
  runWorkerWasm: document.querySelector("#run-worker-wasm"),
  result: document.querySelector("#result"),
  isolation: document.querySelector("#isolation-status"),
  coreCount: document.querySelector("#core-count"),
  runTilesAll: document.querySelector("#run-tiles-all"),
  tileResult: document.querySelector("#tile-result"),
};

paths.forEach((path) => {
  elements[`${path}Canvas`] = document.querySelector(`#${path}-canvas`);
  elements[`${path}Time`] = document.querySelector(`#${path}-time`);
  elements[`${path}State`] = document.querySelector(`#${path}-state`);
  elements[`${path}Meter`] = document.querySelector(`#${path}-meter`);
});

communicationCases.forEach(({ id }) => {
  elements[`${id}MessageCanvas`] = document.querySelector(`#${id}-message-canvas`);
  elements[`${id}SabCanvas`] = document.querySelector(`#${id}-sab-canvas`);
  elements[`${id}MessageTime`] = document.querySelector(`#${id}-message-time`);
  elements[`${id}SabTime`] = document.querySelector(`#${id}-sab-time`);
  elements[`${id}MessageBar`] = document.querySelector(`#${id}-message-bar`);
  elements[`${id}SabBar`] = document.querySelector(`#${id}-sab-bar`);
  elements[`${id}MessageState`] = document.querySelector(`#${id}-message-state`);
  elements[`${id}SabState`] = document.querySelector(`#${id}-sab-state`);
  elements[`${id}RunMessage`] = document.querySelector(`#run-${id}-message`);
  elements[`${id}RunSab`] = document.querySelector(`#run-${id}-sab`);
});

let isRunning = false;
let results = {};
let tileResults = {};

updateEnvironment();
bindEvents();

function bindEvents() {
  elements.workload.addEventListener("input", () => {
    elements.workloadLabel.value = configuration().label;
    resetResults();
  });
  elements.runMain.addEventListener("click", renderOnMainThread);
  elements.runWasm.addEventListener("click", renderWasmOnMainThread);
  elements.runWorker.addEventListener("click", () => renderWithWorkers("worker", "javascript"));
  elements.runWorkerWasm.addEventListener("click", () => renderWithWorkers("worker-wasm", "wasm"));
  elements.runAll.addEventListener("click", renderAll);
  elements.runTilesAll.addEventListener("click", renderAllCommunicationPaths);
  communicationCases.forEach((communicationCase) => {
    elements[`${communicationCase.id}RunMessage`].addEventListener("click", () => renderCommunicationPath(communicationCase, "message"));
    elements[`${communicationCase.id}RunSab`].addEventListener("click", () => renderCommunicationPath(communicationCase, "sab"));
  });
}

function updateEnvironment() {
  elements.coreCount.textContent = `${coreCount} 論理コア / ${workerCount} WORKER`;

  if (hasSharedMemory()) {
    elements.isolation.classList.add("available");
    elements.isolation.lastElementChild.textContent = "共有メモリを利用可能";
    return;
  }

  elements.isolation.classList.add("unavailable");
  elements.isolation.lastElementChild.textContent = "共有メモリを利用不可";
  elements.runWorker.disabled = true;
  elements.runWorkerWasm.disabled = true;
  elements.runAll.disabled = true;
  elements.runTilesAll.disabled = true;
  communicationCases.forEach(({ id }) => {
    elements[`${id}RunSab`].disabled = true;
  });
  setObservation("SharedArrayBuffer には cross-origin isolation が必要です。<code>pnpm dev</code> で起動してください。", "warning");
}

function configuration() {
  return configurations[Number(elements.workload.value)];
}

function hasSharedMemory() {
  return crossOriginIsolated && typeof SharedArrayBuffer !== "undefined";
}

async function renderAll() {
  await renderOnMainThread();
  await nextPaint();
  await renderWasmOnMainThread();
  await nextPaint();
  await renderWithWorkers("worker", "javascript");
  await nextPaint();
  await renderWithWorkers("worker-wasm", "wasm");
}

async function renderAllCommunicationPaths() {
  resetCommunicationResults();
  for (const communicationCase of communicationCases) {
    await renderCommunicationPath(communicationCase, "message");
    await nextPaint();
    await renderCommunicationPath(communicationCase, "sab");
    await nextPaint();
  }
}

async function renderOnMainThread() {
  if (isRunning) return;

  isRunning = true;
  setControlsDisabled(true);
  setPath("main", "描画中: UI も待機", 3);
  await nextPaint();

  const pixels = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4);
  const start = performance.now();

  for (let row = 0; row < IMAGE_HEIGHT; row += 1) {
    renderRow(pixels, row, configuration().iterations);
  }

  drawPixels(elements.mainCanvas, pixels);
  finishPath("main", performance.now() - start);
  isRunning = false;
  setControlsDisabled(false);
}

async function renderWasmOnMainThread() {
  if (isRunning) return;

  isRunning = true;
  setControlsDisabled(true);
  setPath("wasm", "WASM を読み込み中", 3);
  await nextPaint();

  const pixels = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4);
  const start = performance.now();

  try {
    const render = await createWasmRenderer(pixels);
    setPath("wasm", "描画中: UI も待機", 3);

    for (let row = 0; row < IMAGE_HEIGHT; row += 1) {
      render(row, configuration().iterations);
    }

    drawPixels(elements.wasmCanvas, pixels);
    finishPath("wasm", performance.now() - start);
  } catch (error) {
    console.error(error);
    setPath("wasm", "描画に失敗", 0);
    setObservation("Rust WASM の読み込みまたは描画に失敗しました。ブラウザのコンソールを確認してください。", "warning");
  } finally {
    isRunning = false;
    setControlsDisabled(false);
  }
}

async function renderWithWorkers(path, mode) {
  if (isRunning || !hasSharedMemory()) return;

  isRunning = true;
  setControlsDisabled(true);
  setPath(path, mode === "wasm" ? "WASM を読み込み中" : "Worker を起動中", 2);

  const pixelsBuffer = new SharedArrayBuffer(IMAGE_WIDTH * IMAGE_HEIGHT * 4);
  const pixels = new Uint8ClampedArray(pixelsBuffer);
  const controlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const control = new Int32Array(controlBuffer);
  const start = performance.now();
  const workers = Array.from({ length: workerCount }, () => new Worker(workerUrl, { type: "module" }));
  let completedWorkers = 0;
  let frameId = 0;

  const updateProgress = () => {
    const completedRows = Atomics.load(control, 1);
    setPath(path, `${completedRows} / ${IMAGE_HEIGHT} 行を描画`, (completedRows / IMAGE_HEIGHT) * 100);
    frameId = requestAnimationFrame(updateProgress);
  };

  requestAnimationFrame(updateProgress);

  try {
    await new Promise((resolve, reject) => {
      workers.forEach((worker) => {
        worker.addEventListener("message", () => {
          completedWorkers += 1;
          if (completedWorkers === workerCount) resolve();
        }, { once: true });
        worker.addEventListener("error", (event) => reject(event.error), { once: true });
        worker.postMessage({ mode, pixelsBuffer, controlBuffer, iterations: configuration().iterations });
      });
    });

    drawPixels(elements[`${path}Canvas`], pixels);
    finishPath(path, performance.now() - start);
  } catch (error) {
    console.error(error);
    setPath(path, "描画に失敗", 0);
    setObservation("描画に失敗しました。ブラウザのコンソールで Worker または WASM のエラーを確認してください。", "warning");
  } finally {
    cancelAnimationFrame(frameId);
    workers.forEach((worker) => worker.terminate());
    isRunning = false;
    setControlsDisabled(false);
  }
}

async function renderCommunicationPath(communicationCase, mode) {
  if (isRunning || (mode === "sab" && !hasSharedMemory())) return;

  isRunning = true;
  setControlsDisabled(true);
  elements[`${communicationCase.id}${mode === "message" ? "Message" : "Sab"}State`].textContent = "計測中";

  try {
    const elapsed = mode === "message" ? await renderMessageTiles(communicationCase) : await renderSabTiles(communicationCase);
    const measurement = { value: elapsed, label: formatTime(elapsed) };
    finishCommunicationPath(communicationCase.id, mode, measurement);
    updateTileResult();
  } catch (error) {
    console.error(error);
    elements[`${communicationCase.id}${mode === "message" ? "Message" : "Sab"}State`].textContent = "計測に失敗";
    setTileResult("計測に失敗しました。ブラウザのコンソールを確認してください。", "warning");
  } finally {
    isRunning = false;
    setControlsDisabled(false);
  }
}

async function renderMessageTiles(tileCase) {
  const canvas = elements[`${tileCase.id}MessageCanvas`];
  const image = canvas.getContext("2d").createImageData(IMAGE_WIDTH, IMAGE_HEIGHT);
  const activeWorkerCount = Math.min(workerCount, tileCase.tileCount);
  const workers = Array.from({ length: activeWorkerCount }, () => new Worker(messageTileWorkerUrl, { type: "module" }));
  let nextTile = 0;
  let completedTiles = 0;
  const start = performance.now();

  try {
    await new Promise((resolve, reject) => {
      const dispatch = (worker) => {
        if (nextTile >= tileCase.tileCount) return;

        worker.postMessage({
          type: "task",
          tile: nextTile,
          tileWidth: tileCase.tileWidth,
          tileHeight: tileCase.tileHeight,
        });
        nextTile += 1;
      };

      workers.forEach((worker) => {
        worker.addEventListener("message", ({ data }) => {
          if (data.type === "ready") {
            dispatch(worker);
            return;
          }

          drawTile(image, data.tile, tileCase.tileWidth, tileCase.tileHeight, new Uint8ClampedArray(data.pixels));
          completedTiles += 1;
          if (completedTiles === tileCase.tileCount) {
            resolve();
            return;
          }

          dispatch(worker);
        });
        worker.addEventListener("error", (event) => reject(event.error), { once: true });
      });
    });

    canvas.getContext("2d").putImageData(image, 0, 0);
    return performance.now() - start;
  } finally {
    workers.forEach((worker) => worker.terminate());
  }
}

async function renderSabTiles(tileCase) {
  const pixelsBuffer = new SharedArrayBuffer(IMAGE_WIDTH * IMAGE_HEIGHT * 4);
  const pixels = new Uint8ClampedArray(pixelsBuffer);
  const controlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const control = new Int32Array(controlBuffer);
  const activeWorkerCount = Math.min(workerCount, tileCase.tileCount);
  const workers = Array.from({ length: activeWorkerCount }, () => new Worker(sabTileWorkerUrl, { type: "module" }));
  let completedWorkers = 0;
  const start = performance.now();

  try {
    await new Promise((resolve, reject) => {
      workers.forEach((worker) => {
        worker.addEventListener("message", () => {
          completedWorkers += 1;
          if (completedWorkers === activeWorkerCount) resolve();
        }, { once: true });
        worker.addEventListener("error", (event) => reject(event.error), { once: true });
        worker.postMessage({
          pixelsBuffer,
          controlBuffer,
          tileCount: tileCase.tileCount,
          tileWidth: tileCase.tileWidth,
          tileHeight: tileCase.tileHeight,
        });
      });
    });

    drawPixels(elements[`${tileCase.id}SabCanvas`], pixels);
    return performance.now() - start;
  } finally {
    workers.forEach((worker) => worker.terminate());
  }
}

function drawTile(image, tile, tileWidth, tileHeight, pixels) {
  const tileColumns = IMAGE_WIDTH / tileWidth;
  const startColumn = (tile % tileColumns) * tileWidth;
  const startRow = Math.floor(tile / tileColumns) * tileHeight;

  for (let row = 0; row < tileHeight; row += 1) {
    const destination = ((startRow + row) * IMAGE_WIDTH + startColumn) * 4;
    const source = row * tileWidth * 4;
    image.data.set(pixels.subarray(source, source + tileWidth * 4), destination);
  }
}

function drawPixels(canvas, pixels) {
  const context = canvas.getContext("2d");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), IMAGE_WIDTH, IMAGE_HEIGHT), 0, 0);
}

function finishPath(path, elapsed) {
  results[path] = elapsed;
  elements[`${path}Time`].textContent = formatTime(elapsed);
  setPath(path, "描画完了", 100);
  updateObservation();
}

function finishCommunicationPath(id, mode, measurement) {
  const key = mode === "message" ? "Message" : "Sab";
  const resultKey = mode === "message" ? "messageValue" : "sabValue";
  tileResults[id] ??= {};
  tileResults[id][resultKey] = measurement.value;
  elements[`${id}${key}Time`].textContent = measurement.label;
  elements[`${id}${key}State`].textContent = "計測完了";
  updateCommunicationBars(id);
}

function updateCommunicationBars(id) {
  const result = tileResults[id];
  if (!result?.messageValue || !result?.sabValue) {
    if (result?.messageValue) elements[`${id}MessageBar`].style.width = "100%";
    if (result?.sabValue) elements[`${id}SabBar`].style.width = "100%";
    return;
  }

  const longest = Math.max(result.messageValue, result.sabValue);
  elements[`${id}MessageBar`].style.width = `${Math.max(3, (result.messageValue / longest) * 100)}%`;
  elements[`${id}SabBar`].style.width = `${Math.max(3, (result.sabValue / longest) * 100)}%`;
}

function updateObservation() {
  if (!results.main || !results.wasm || !results.worker || !results["worker-wasm"]) {
    setObservation("4 つの画像を描画すると、端末上の実測値を比較します。");
    return;
  }

  const wasmSpeed = results.main / results.wasm;
  const workerSpeed = results.main / results.worker;
  const workerWasmSpeed = results.main / results["worker-wasm"];
  setObservation(`<strong>WASM: ${wasmSpeed.toFixed(1)}× / Worker: ${workerSpeed.toFixed(1)}× / Worker + WASM: ${workerWasmSpeed.toFixed(1)}×</strong> メインスレッド JavaScript を基準にした実測値です。`, "success");
}

function updateTileResult() {
  const fineComplete = tileResults.fine?.messageValue && tileResults.fine?.sabValue;

  if (!fineComplete) {
    setTileResult("2 経路を実行すると、受け渡し方式による差を比較します。");
    return;
  }

  const fine = formatVerdict(tileResults.fine.messageValue, tileResults.fine.sabValue);
  setTileResult(`<strong>144,000 個の結果: ${fine}</strong>`, "success");
}

function formatVerdict(messageTime, sabTime) {
  const ratio = messageTime / sabTime;

  if (ratio > 1.25) return `SAB ${ratio.toFixed(1)}×`;
  if (ratio < 0.8) return `postMessage ${(1 / ratio).toFixed(1)}×`;
  return "ほぼ同じ";
}

function setPath(path, state, percentage) {
  elements[`${path}State`].textContent = state;
  elements[`${path}Meter`].style.width = `${percentage}%`;
}

function setControlsDisabled(disabled) {
  const workerDisabled = disabled || !hasSharedMemory();

  elements.workload.disabled = disabled;
  elements.runAll.disabled = workerDisabled;
  elements.runMain.disabled = disabled;
  elements.runWorker.disabled = workerDisabled;
  elements.runWasm.disabled = disabled;
  elements.runWorkerWasm.disabled = workerDisabled;
  elements.runTilesAll.disabled = workerDisabled;
  communicationCases.forEach(({ id }) => {
    elements[`${id}RunMessage`].disabled = disabled;
    elements[`${id}RunSab`].disabled = workerDisabled;
  });
}

function resetResults() {
  results = {};
  paths.forEach((path) => {
    elements[`${path}Time`].textContent = "—";
    setPath(path, "準備完了", 0);
  });
  updateObservation();
}

function resetCommunicationResults() {
  tileResults = {};
  communicationCases.forEach(({ id }) => {
    elements[`${id}MessageTime`].textContent = "—";
    elements[`${id}SabTime`].textContent = "—";
    elements[`${id}MessageBar`].style.width = "0";
    elements[`${id}SabBar`].style.width = "0";
    elements[`${id}MessageState`].textContent = "準備完了";
    elements[`${id}SabState`].textContent = "準備完了";
  });
  updateTileResult();
}

function setObservation(message, type = "") {
  elements.result.className = `result ${type}`;
  elements.result.querySelector(".result-text").innerHTML = message;
}

function setTileResult(message, type = "") {
  elements.tileResult.className = `tile-result ${type}`;
  elements.tileResult.querySelector(".tile-result-text").innerHTML = message;
}

function formatTime(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} 秒`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
