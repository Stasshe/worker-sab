const CONTROL_SIZE = 2;

self.onmessage = ({ data }) => {
  const control = new Int32Array(data.memory, 0, CONTROL_SIZE);
  const output = new Int32Array(data.memory, CONTROL_SIZE * Int32Array.BYTES_PER_ELEMENT, data.taskCount);

  for (;;) {
    const taskIndex = Atomics.add(control, 0, 1);
    if (taskIndex >= data.taskCount) break;

    output[taskIndex] = calculate(taskIndex + 1, data.iterations);
    Atomics.add(control, 1, 1);
  }

  self.postMessage({ type: "done" });
};

function calculate(seed, iterations) {
  let value = seed;

  for (let index = 0; index < iterations; index += 1) {
    value = Math.imul(value ^ (value >>> 15), 2246822519);
    value ^= value >>> 13;
  }

  return value;
}
