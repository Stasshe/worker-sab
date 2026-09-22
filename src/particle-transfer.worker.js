import { PARTICLE_COUNT } from "./particles.js";

let positions;
let velocityX;
let velocityY;
let pointerX = 0.5;
let pointerY = 0.5;
let active = false;
let ticks = 0;

self.onmessage = ({ data }) => {
  if (data.type === "start") {
    initialize();
    active = true;
    tick();
    return;
  }

  if (data.type === "recycle") {
    positions = new Float32Array(data.buffer);
    tick();
    return;
  }

  if (data.type === "pointer") {
    pointerX = data.x;
    pointerY = data.y;
    return;
  }

  active = false;
};

function initialize() {
  positions = new Float32Array(PARTICLE_COUNT * 2);
  velocityX = new Float32Array(PARTICLE_COUNT);
  velocityY = new Float32Array(PARTICLE_COUNT);

  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    positions[particle * 2] = Math.random();
    positions[particle * 2 + 1] = Math.random();
    velocityX[particle] = (Math.random() - 0.5) * 0.004;
    velocityY[particle] = (Math.random() - 0.5) * 0.004;
  }
}

function tick() {
  if (!active || !positions) return;

  updateParticles(positions, velocityX, velocityY, pointerX, pointerY);
  ticks += 1;
  self.postMessage({ type: "frame", buffer: positions.buffer, ticks }, [positions.buffer]);
  positions = undefined;
}

function updateParticles(nextPositions, nextVelocityX, nextVelocityY, targetX, targetY) {
  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const position = particle * 2;
    const dx = targetX - nextPositions[position];
    const dy = targetY - nextPositions[position + 1];
    const inverseDistance = 1 / (dx * dx + dy * dy + 0.01);
    const pullX = dx * inverseDistance * 0.000018;
    const pullY = dy * inverseDistance * 0.000018;
    const swirlX = -dy * inverseDistance * 0.00004;
    const swirlY = dx * inverseDistance * 0.00004;

    nextVelocityX[particle] = limitVelocity((nextVelocityX[particle] + pullX + swirlX) * 0.997);
    nextVelocityY[particle] = limitVelocity((nextVelocityY[particle] + pullY + swirlY) * 0.997);
    nextPositions[position] = wrap(nextPositions[position] + nextVelocityX[particle]);
    nextPositions[position + 1] = wrap(nextPositions[position + 1] + nextVelocityY[particle]);
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
