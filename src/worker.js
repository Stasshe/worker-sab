import { IMAGE_HEIGHT, IMAGE_WIDTH, renderRow } from "./fractal.js";

const wasmUrl = new URL("/wasm/wasm32-unknown-unknown/release/mandelbrot.wasm", self.location.origin);

self.onmessage = async ({ data }) => {
  const pixels = new Uint8ClampedArray(data.pixelsBuffer);
  const control = new Int32Array(data.controlBuffer);
  const render = data.mode === "wasm" ? await createWasmRenderer(pixels) : (row) => renderRow(pixels, row, data.iterations);

  for (;;) {
    const row = Atomics.add(control, 0, 1);
    if (row >= IMAGE_HEIGHT) break;

    render(row, data.iterations);
    Atomics.add(control, 1, 1);
  }

  self.postMessage({ type: "done" });
};

async function createWasmRenderer(pixels) {
  const response = await fetch(wasmUrl);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const exports = instance.exports;
  const memory = exports.memory;
  const outputPointer = exports.output_ptr();

  return (row, iterations) => {
    exports.render_row(row, IMAGE_WIDTH, IMAGE_HEIGHT, iterations);
    const rowPixels = new Uint8ClampedArray(memory.buffer, outputPointer, IMAGE_WIDTH * 4);
    pixels.set(rowPixels, row * IMAGE_WIDTH * 4);
  };
}
