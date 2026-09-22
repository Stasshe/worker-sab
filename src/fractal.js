export const IMAGE_WIDTH = 960;
export const IMAGE_HEIGHT = 600;

export const configurations = [
  { iterations: 1_200, label: "軽量 · 1,200 回" },
  { iterations: 4_000, label: "高負荷 · 4,000 回" },
  { iterations: 10_000, label: "極負荷 · 10,000 回" },
];

export function renderRow(pixels, row, maxIterations) {
  const offset = row * IMAGE_WIDTH * 4;

  for (let column = 0; column < IMAGE_WIDTH; column += 1) {
    writePixel(pixels, offset + column * 4, column, row, maxIterations);
  }
}

export function renderHeatmapTile(pixels, tile, tileWidth, tileHeight) {
  const tileColumns = IMAGE_WIDTH / tileWidth;
  const startColumn = (tile % tileColumns) * tileWidth;
  const startRow = Math.floor(tile / tileColumns) * tileHeight;

  for (let row = 0; row < tileHeight; row += 1) {
    for (let column = 0; column < tileWidth; column += 1) {
      writeHeatmapPixel(pixels, (row * tileWidth + column) * 4, startColumn + column, startRow + row);
    }
  }
}

export function renderHeatmapTileToImage(pixels, tile, tileWidth, tileHeight) {
  const tileColumns = IMAGE_WIDTH / tileWidth;
  const startColumn = (tile % tileColumns) * tileWidth;
  const startRow = Math.floor(tile / tileColumns) * tileHeight;

  for (let row = 0; row < tileHeight; row += 1) {
    for (let column = 0; column < tileWidth; column += 1) {
      const offset = ((startRow + row) * IMAGE_WIDTH + startColumn + column) * 4;
      writeHeatmapPixel(pixels, offset, startColumn + column, startRow + row);
    }
  }
}

function writePixel(pixels, offset, column, row, maxIterations) {
  const real = (column / IMAGE_WIDTH) * 0.1 - 0.8;
  const imaginary = (row / IMAGE_HEIGHT) * 0.0625 + 0.06875;
  let zx = 0;
  let zy = 0;
  let iteration = 0;

  while (zx * zx + zy * zy <= 4 && iteration < maxIterations) {
    const nextReal = zx * zx - zy * zy + real;
    zy = 2 * zx * zy + imaginary;
    zx = nextReal;
    iteration += 1;
  }

  writeColor(pixels, offset, iteration, maxIterations);
}

function writeColor(pixels, offset, iteration, maxIterations) {
  if (iteration === maxIterations) {
    pixels[offset] = 8;
    pixels[offset + 1] = 13;
    pixels[offset + 2] = 29;
    pixels[offset + 3] = 255;
    return;
  }

  pixels[offset] = (iteration * 9) % 256;
  pixels[offset + 1] = (iteration * 3 + 40) % 256;
  pixels[offset + 2] = (iteration * 13 + 90) % 256;
  pixels[offset + 3] = 255;
}

function writeHeatmapPixel(pixels, offset, column, row) {
  const x = column / IMAGE_WIDTH;
  const y = row / IMAGE_HEIGHT;
  const first = Math.hypot(x - 0.22, y - 0.28);
  const second = Math.hypot(x - 0.74, y - 0.36);
  const third = Math.hypot(x - 0.48, y - 0.76);
  const distance = Math.min(first, second, third);
  const contour = Math.max(0, 1 - distance * 2.2);
  const bands = (Math.sin(distance * 74) + 1) * 0.5;

  pixels[offset] = Math.round(25 + contour * 60 + bands * 35);
  pixels[offset + 1] = Math.round(45 + contour * 125 + bands * 45);
  pixels[offset + 2] = Math.round(85 + contour * 150 + bands * 75);
  pixels[offset + 3] = 255;
}
