import { renderHeatmapTile } from "./fractal.js";

self.onmessage = ({ data }) => {
  if (data.type === "task") {
    const pixels = new Uint8ClampedArray(data.tileWidth * data.tileHeight * 4);
    renderHeatmapTile(pixels, data.tile, data.tileWidth, data.tileHeight);
    self.postMessage({ type: "complete", tile: data.tile, pixels: pixels.buffer }, [pixels.buffer]);
    return;
  }

  self.postMessage({ type: "ready" });
};

self.postMessage({ type: "ready" });
