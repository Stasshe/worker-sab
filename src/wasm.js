import { IMAGE_HEIGHT, IMAGE_WIDTH } from "./fractal.js";

const wasmUrl = new URL("/wasm/wasm32-unknown-unknown/release/mandelbrot.wasm", globalThis.location.origin);

export async function createWasmRenderer(pixels) {
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
