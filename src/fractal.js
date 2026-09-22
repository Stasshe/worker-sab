export const IMAGE_WIDTH = 960;
export const IMAGE_HEIGHT = 600;

export const configurations = [
  { iterations: 1_200, label: "軽量 · 1,200 回" },
  { iterations: 4_000, label: "高負荷 · 4,000 回" },
  { iterations: 10_000, label: "極負荷 · 10,000 回" },
];

export function renderRow(pixels, row, maxIterations) {
  const offset = row * IMAGE_WIDTH * 4;
  const imaginary = (row / IMAGE_HEIGHT) * 0.0625 + 0.06875;

  for (let column = 0; column < IMAGE_WIDTH; column += 1) {
    const real = (column / IMAGE_WIDTH) * 0.1 - 0.8;
    let zx = 0;
    let zy = 0;
    let iteration = 0;

    while (zx * zx + zy * zy <= 4 && iteration < maxIterations) {
      const nextReal = zx * zx - zy * zy + real;
      zy = 2 * zx * zy + imaginary;
      zx = nextReal;
      iteration += 1;
    }

    writeColor(pixels, offset + column * 4, iteration, maxIterations);
  }
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
