import { configurations, IMAGE_HEIGHT, IMAGE_WIDTH, renderRow } from "./fractal.js";
import "./style.css";

const workerUrl = new URL("./worker.js", import.meta.url);
const coreCount = navigator.hardwareConcurrency || 4;
const workerCount = Math.max(1, Math.min(coreCount - 1, 8));
const paths = ["main", "worker", "wasm"];

const elements = {
  workload: document.querySelector("#workload"),
  workloadLabel: document.querySelector("#workload-label"),
  runAll: document.querySelector("#run-all"),
  runMain: document.querySelector("#run-main"),
  runWorker: document.querySelector("#run-worker"),
  runWasm: document.querySelector("#run-wasm"),
  result: document.querySelector("#result"),
  isolation: document.querySelector("#isolation-status"),
  coreCount: document.querySelector("#core-count"),
};

paths.forEach((path) => {
  elements[`${path}Canvas`] = document.querySelector(`#${path}-canvas`);
  elements[`${path}Time`] = document.querySelector(`#${path}-time`);
  elements[`${path}State`] = document.querySelector(`#${path}-state`);
  elements[`${path}Meter`] = document.querySelector(`#${path}-meter`);
});

let isRunning = false;
let results = {};

updateEnvironment();
bindEvents();

function bindEvents() {
  elements.workload.addEventListener("input", () => {
    elements.workloadLabel.value = configuration().label;
    resetResults();
  });
  elements.runMain.addEventListener("click", renderOnMainThread);
  elements.runWorker.addEventListener("click", () => renderWithWorkers("worker", "javascript"));
  elements.runWasm.addEventListener("click", () => renderWithWorkers("wasm", "wasm"));
  elements.runAll.addEventListener("click", renderAll);
}

function updateEnvironment() {
  elements.coreCount.textContent = `${coreCount} 論理コア / ${workerCount} WORKER`;

  if (crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") {
    elements.isolation.classList.add("available");
    elements.isolation.lastElementChild.textContent = "共有メモリを利用可能";
    return;
  }

  elements.isolation.classList.add("unavailable");
  elements.isolation.lastElementChild.textContent = "共有メモリを利用不可";
  elements.runWorker.disabled = true;
  elements.runWasm.disabled = true;
  elements.runAll.disabled = true;
  setObservation("SharedArrayBuffer には cross-origin isolation が必要です。<code>pnpm dev</code> で起動してください。", "warning");
}

function configuration() {
  return configurations[Number(elements.workload.value)];
}

async function renderAll() {
  await renderOnMainThread();
  await nextPaint();
  await renderWithWorkers("worker", "javascript");
  await nextPaint();
  await renderWithWorkers("wasm", "wasm");
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

  drawPixels("main", pixels);
  finishPath("main", performance.now() - start);
  isRunning = false;
  setControlsDisabled(false);
}

async function renderWithWorkers(path, mode) {
  if (isRunning || !crossOriginIsolated) return;

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

    drawPixels(path, pixels);
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

function drawPixels(path, pixels) {
  const context = elements[`${path}Canvas`].getContext("2d");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), IMAGE_WIDTH, IMAGE_HEIGHT), 0, 0);
}

function finishPath(path, elapsed) {
  results[path] = elapsed;
  elements[`${path}Time`].textContent = formatTime(elapsed);
  setPath(path, "描画完了", 100);
  updateObservation();
}

function updateObservation() {
  if (!results.main || !results.worker || !results.wasm) {
    setObservation("3 つの画像を描画すると、端末上の実測値を比較します。");
    return;
  }

  const workerSpeed = results.main / results.worker;
  const wasmSpeed = results.main / results.wasm;
  setObservation(`<strong>Worker + SAB: ${workerSpeed.toFixed(1)}× / Rust WASM: ${wasmSpeed.toFixed(1)}×</strong> メインスレッド JavaScript と比較した実測値です。`, "success");
}

function setPath(path, state, percentage) {
  elements[`${path}State`].textContent = state;
  elements[`${path}Meter`].style.width = `${percentage}%`;
}

function setControlsDisabled(disabled) {
  elements.workload.disabled = disabled;
  elements.runAll.disabled = disabled;
  elements.runMain.disabled = disabled;
  elements.runWorker.disabled = disabled;
  elements.runWasm.disabled = disabled;
}

function resetResults() {
  results = {};
  paths.forEach((path) => {
    elements[`${path}Time`].textContent = "—";
    setPath(path, "準備完了", 0);
  });
  updateObservation();
}

function setObservation(message, type = "") {
  elements.result.className = `result ${type}`;
  elements.result.querySelector(".result-text").innerHTML = message;
}

function formatTime(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} 秒`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
