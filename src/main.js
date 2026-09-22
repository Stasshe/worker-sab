import "./style.css";

const configurations = [
  { tasks: 18, iterations: 4_000_000, label: "72M OPS" },
  { tasks: 24, iterations: 6_000_000, label: "144M OPS" },
  { tasks: 32, iterations: 8_000_000, label: "256M OPS" },
];
const workerUrl = new URL("./worker.js", import.meta.url);
const coreCount = navigator.hardwareConcurrency || 4;
const workerCount = Math.max(1, Math.min(coreCount - 1, 8));

const elements = {
  workload: document.querySelector("#workload"),
  workloadLabel: document.querySelector("#workload-label"),
  runAll: document.querySelector("#run-all"),
  runMain: document.querySelector("#run-main"),
  runWorker: document.querySelector("#run-worker"),
  mainTime: document.querySelector("#main-time"),
  workerTime: document.querySelector("#worker-time"),
  mainState: document.querySelector("#main-state"),
  workerState: document.querySelector("#worker-state"),
  mainMeter: document.querySelector("#main-meter"),
  workerMeter: document.querySelector("#worker-meter"),
  result: document.querySelector("#result"),
  isolation: document.querySelector("#isolation-status"),
  coreCount: document.querySelector("#core-count"),
};

let isRunning = false;
let results = { main: null, worker: null };

updateEnvironment();
bindEvents();

function bindEvents() {
  elements.workload.addEventListener("input", () => {
    elements.workloadLabel.value = selectedConfiguration().label;
    resetResults();
  });
  elements.runMain.addEventListener("click", runMainThread);
  elements.runWorker.addEventListener("click", runWorkerPool);
  elements.runAll.addEventListener("click", runComparison);
}

function updateEnvironment() {
  elements.coreCount.textContent = `${coreCount} LOGICAL CORES / ${workerCount} WORKERS`;

  if (crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") {
    elements.isolation.classList.add("available");
    elements.isolation.lastElementChild.textContent = "SHARED MEMORY ENABLED";
    return;
  }

  elements.isolation.classList.add("unavailable");
  elements.isolation.lastElementChild.textContent = "SHARED MEMORY UNAVAILABLE";
  elements.runWorker.disabled = true;
  elements.runAll.disabled = true;
  setObservation("SharedArrayBuffer needs cross-origin isolation. Start this demo with <code>pnpm dev</code>.", "warning");
}

function selectedConfiguration() {
  return configurations[Number(elements.workload.value)];
}

async function runComparison() {
  await runMainThread();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await runWorkerPool();
}

async function runMainThread() {
  if (isRunning) return;

  isRunning = true;
  setControlsDisabled(true);
  setLane("main", "WORKING", 7);
  await nextPaint();

  const configuration = selectedConfiguration();
  const start = performance.now();
  let checksum = 0;

  for (let taskIndex = 0; taskIndex < configuration.tasks; taskIndex += 1) {
    checksum ^= calculate(taskIndex + 1, configuration.iterations);
  }

  const elapsed = performance.now() - start;
  finishLane("main", elapsed, checksum);
  isRunning = false;
  setControlsDisabled(false);
}

async function runWorkerPool() {
  if (isRunning || !crossOriginIsolated) return;

  isRunning = true;
  setControlsDisabled(true);
  setLane("worker", "SPINNING UP", 4);

  const configuration = selectedConfiguration();
  const memory = new SharedArrayBuffer((2 + configuration.tasks) * Int32Array.BYTES_PER_ELEMENT);
  const control = new Int32Array(memory, 0, 2);
  const output = new Int32Array(memory, 2 * Int32Array.BYTES_PER_ELEMENT, configuration.tasks);
  const workers = Array.from({ length: workerCount }, () => new Worker(workerUrl, { type: "module" }));
  const start = performance.now();
  let completedWorkers = 0;
  let frameId = 0;

  const progress = () => {
    const completedTasks = Atomics.load(control, 1);
    const percentage = (completedTasks / configuration.tasks) * 100;
    setLane("worker", `${completedTasks} / ${configuration.tasks} TASKS`, percentage);
    frameId = requestAnimationFrame(progress);
  };

  requestAnimationFrame(progress);

  await new Promise((resolve) => {
    workers.forEach((worker) => {
      worker.addEventListener("message", () => {
        completedWorkers += 1;
        if (completedWorkers === workerCount) resolve();
      }, { once: true });
      worker.postMessage({ memory, taskCount: configuration.tasks, iterations: configuration.iterations });
    });
  });

  cancelAnimationFrame(frameId);
  workers.forEach((worker) => worker.terminate());
  const checksum = output.reduce((total, value) => total ^ value, 0);
  const elapsed = performance.now() - start;
  finishLane("worker", elapsed, checksum);
  isRunning = false;
  setControlsDisabled(false);
}

function calculate(seed, iterations) {
  let value = seed;

  for (let index = 0; index < iterations; index += 1) {
    value = Math.imul(value ^ (value >>> 15), 2246822519);
    value ^= value >>> 13;
  }

  return value;
}

function finishLane(lane, elapsed, checksum) {
  results[lane] = elapsed;
  elements[`${lane}Time`].textContent = formatTime(elapsed);
  setLane(lane, `DONE · ${formatChecksum(checksum)}`, 100);
  updateObservation();
}

function updateObservation() {
  if (!results.main || !results.worker) {
    setObservation("Run both lanes to measure the difference on this device.");
    return;
  }

  const speedup = results.main / results.worker;
  const speedText = speedup >= 1 ? `${speedup.toFixed(1)}× faster` : `${(1 / speedup).toFixed(1)}× slower`;
  setObservation(`<strong>${speedText}</strong> on this device. The real win: the interface stayed responsive while the workers ran.`, "success");
}

function setLane(lane, state, percentage) {
  elements[`${lane}State`].textContent = state;
  elements[`${lane}Meter`].style.width = `${percentage}%`;
}

function setControlsDisabled(disabled) {
  elements.workload.disabled = disabled;
  elements.runAll.disabled = disabled;
  elements.runMain.disabled = disabled;
  elements.runWorker.disabled = disabled;
}

function resetResults() {
  results = { main: null, worker: null };
  ["main", "worker"].forEach((lane) => {
    elements[`${lane}Time`].textContent = "—";
    setLane(lane, "READY", 0);
  });
  updateObservation();
}

function setObservation(message, type = "") {
  elements.result.className = `result ${type}`;
  elements.result.querySelector(".result-text").innerHTML = message;
}

function formatTime(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function formatChecksum(value) {
  return `HASH ${String(value >>> 0).padStart(10, "0")}`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
