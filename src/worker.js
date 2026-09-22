import { IMAGE_HEIGHT, renderRow } from "./fractal.js";
import { createWasmRenderer } from "./wasm.js";

self.onmessage = async ({ data }) => {
  const pixels = new Uint8ClampedArray(data.pixelsBuffer);
  const control = new Int32Array(data.controlBuffer);
  let render;
  if (data.mode === "wasm") {
    render = await createWasmRenderer(pixels);
  } else {
    render = (row) => renderRow(pixels, row, data.iterations);
  }

  for (;;) {
    const row = Atomics.add(control, 0, 1);
    if (row >= IMAGE_HEIGHT) break;

    render(row, data.iterations);
    Atomics.add(control, 1, 1);
  }

  self.postMessage({ type: "done" });
};
