import { renderHeatmapTileToImage } from "./fractal.js";

self.onmessage = ({ data }) => {
  const pixels = new Uint8ClampedArray(data.pixelsBuffer);
  const control = new Int32Array(data.controlBuffer);

  for (;;) {
    const tile = Atomics.add(control, 0, 1);
    if (tile >= data.tileCount) break;

    renderHeatmapTileToImage(pixels, tile, data.tileWidth, data.tileHeight);
    Atomics.add(control, 1, 1);
  }

  self.postMessage({ type: "done" });
};
