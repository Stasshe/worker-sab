export const PARTICLE_COUNT = 16_000;

export function drawParticles(canvas, imageData, positions) {
  const pixels = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  pixels.fill(0);

  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const x = Math.floor(positions[particle * 2] * width);
    const y = Math.floor(positions[particle * 2 + 1] * height);
    const offset = (y * width + x) * 4;

    pixels[offset] = 52;
    pixels[offset + 1] = 103;
    pixels[offset + 2] = 255;
    pixels[offset + 3] = 210;
  }

  canvas.getContext("2d").putImageData(imageData, 0, 0);
}
