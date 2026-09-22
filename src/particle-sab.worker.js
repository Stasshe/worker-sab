import { PARTICLE_COUNT } from "./particles.js";

let firstFrame;
let secondFrame;
let control;
let velocityX;
let velocityY;
let active = false;

self.onmessage = ({ data }) => {
  if (data.type === "start") {
    firstFrame = new Float32Array(data.positionsBuffer, 0, PARTICLE_COUNT * 2);
    secondFrame = new Float32Array(data.positionsBuffer, firstFrame.byteLength, PARTICLE_COUNT * 2);
    control = new Int32Array(data.controlBuffer);
    velocityX = new Float32Array(PARTICLE_COUNT);
    velocityY = new Float32Array(PARTICLE_COUNT);
    initialize();
    active = true;
    tick();
    return;
  }

  active = false;
};

function initialize() {
  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const position = particle * 2;
    firstFrame[position] = Math.random();
    firstFrame[position + 1] = Math.random();
    secondFrame[position] = firstFrame[position];
    secondFrame[position + 1] = firstFrame[position + 1];
    velocityX[particle] = (Math.random() - 0.5) * 0.004;
    velocityY[particle] = (Math.random() - 0.5) * 0.004;
  }
}

function tick() {
  if (!active) return;

  const currentFrame = Atomics.load(control, 0);
  let nextFrame;
  let previousFrame;
  let nextFrameIndex;

  if (currentFrame === 0) {
    nextFrame = secondFrame;
    previousFrame = firstFrame;
    nextFrameIndex = 1;
  } else {
    nextFrame = firstFrame;
    previousFrame = secondFrame;
    nextFrameIndex = 0;
  }

  const pointerX = Atomics.load(control, 2) / 10_000;
  const pointerY = Atomics.load(control, 3) / 10_000;

  updateParticles(nextFrame, previousFrame, pointerX, pointerY);
  Atomics.store(control, 0, nextFrameIndex);
  Atomics.add(control, 1, 1);
  Atomics.add(control, 4, 1);
  setTimeout(tick, 0);
}

function updateParticles(nextPositions, previousPositions, targetX, targetY) {
  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const position = particle * 2;
    const dx = targetX - previousPositions[position];
    const dy = targetY - previousPositions[position + 1];
    const inverseDistance = 1 / (dx * dx + dy * dy + 0.01);
    const pullX = dx * inverseDistance * 0.000018;
    const pullY = dy * inverseDistance * 0.000018;
    const swirlX = -dy * inverseDistance * 0.00004;
    const swirlY = dx * inverseDistance * 0.00004;

    velocityX[particle] = limitVelocity((velocityX[particle] + pullX + swirlX) * 0.997);
    velocityY[particle] = limitVelocity((velocityY[particle] + pullY + swirlY) * 0.997);
    nextPositions[position] = wrap(previousPositions[position] + velocityX[particle]);
    nextPositions[position + 1] = wrap(previousPositions[position + 1] + velocityY[particle]);
  }
}

function limitVelocity(value) {
  if (value < -0.008) return -0.008;
  if (value > 0.008) return 0.008;
  return value;
}

function wrap(value) {
  return value - Math.floor(value);
}
