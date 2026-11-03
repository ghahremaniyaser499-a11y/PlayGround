const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const timeEl = document.getElementById('time');
const moveButtons = [...document.querySelectorAll('.move-btn')];

const config = {
  goalScore: 120,
  levelTime: 45,
  playerSpeed: 340,
  meteorSpawnBase: 1.1,
  crystalSpawnBase: 1.4,
};

const state = {
  running: false,
  gameOver: false,
  countdown: config.levelTime,
  score: 0,
  best: Number(localStorage.getItem('nova-drift-best') || 0),
  meteorTimer: config.meteorSpawnBase,
  crystalTimer: config.crystalSpawnBase,
  lastTime: 0,
  backgroundStars: [],
};

const input = { left: false, right: false };

const player = {
  x: canvas.width / 2,
  y: canvas.height - 52,
  width: 36,
  height: 30,
  speed: config.playerSpeed,
  invulnerable: 0,
  lives: 3,
};

let crystals = [];
let meteors = [];
let particles = [];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createBackground() {
  state.backgroundStars = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: randomBetween(1, 2.8),
    speed: randomBetween(18, 70),
    alpha: randomBetween(0.2, 1),
  }));
}

function refreshBackground(dt) {
  for (const star of state.backgroundStars) {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = -6;
      star.x = Math.random() * canvas.width;
    }
  }
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(player.lives);
  timeEl.textContent = state.countdown.toFixed(1);
}

function showOverlay(title, text, buttonText = 'Start Mission') {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function resetGame() {
  player.x = canvas.width / 2;
  player.y = canvas.height - 52;
  player.invulnerable = 0;
  player.lives = 3;
  state.score = 0;
  state.countdown = config.levelTime;
  state.running = true;
  state.gameOver = false;
  state.meteorTimer = config.meteorSpawnBase;
  state.crystalTimer = config.crystalSpawnBase;
  crystals = [];
  meteors = [];
  particles = [];
  updateHud();
}

function createCrystal() {
  const radius = 10;
  crystals.push({
    x: randomBetween(radius + 18, canvas.width - radius - 18),
    y: -24,
    radius,
    drift: randomBetween(-20, 20),
    speed: randomBetween(90, 180),
    tint: Math.random() > 0.5 ? '#ffd166' : '#57e6ff',
  });
}

function createMeteor() {
  const size = randomBetween(16, 28);
  meteors.push({
    x: randomBetween(size, canvas.width - size),
    y: -size,
    radius: size,
    speed: randomBetween(120, 260),
    drift: randomBetween(-70, 70),
    rotation: randomBetween(0, Math.PI * 2),
    spin: randomBetween(-1.8, 1.8),
  });
}

function spawnBurst(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randomBetween(-120, 120),
      vy: randomBetween(-120, 120),
      size: randomBetween(2, 5),
      life: randomBetween(0.45, 0.9),
      color,
    });
  }
}

function handleInput(dt) {
  if (input.left) {
    player.x -= player.speed * dt;
  }
  if (input.right) {
    player.x += player.speed * dt;
  }
  player.x = clamp(player.x, player.width / 2 + 14, canvas.width - player.width / 2 - 14);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateCrystals(dt) {
  for (let i = crystals.length - 1; i >= 0; i -= 1) {
    const crystal = crystals[i];
    crystal.y += crystal.speed * dt;
    crystal.x += crystal.drift * dt;
    if (crystal.x < 18 || crystal.x > canvas.width - 18) {
      crystal.drift *= -1;
    }

    const dx = crystal.x - player.x;
    const dy = crystal.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < crystal.radius + player.width * 0.45) {
      state.score += 10;
      spawnBurst(crystal.x, crystal.y, '#ffd166', 16);
      crystals.splice(i, 1);
      if (state.score >= config.goalScore) {
        finishRun(true);
        return;
      }
      continue;
    }

    if (crystal.y > canvas.height + 24) {
      crystals.splice(i, 1);
    }
  }
}

function updateMeteors(dt) {
  for (let i = meteors.length - 1; i >= 0; i -= 1) {
    const meteor = meteors[i];
    meteor.y += meteor.speed * dt;
    meteor.x += meteor.drift * dt;
    meteor.rotation += meteor.spin * dt;

    const dx = meteor.x - player.x;
    const dy = meteor.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < meteor.radius + player.width * 0.4) {
      if (player.invulnerable <= 0) {
        player.lives -= 1;
        player.invulnerable = 1.4;
        spawnBurst(player.x, player.y, '#ff5d6c', 20);
        meteors.splice(i, 1);
        if (player.lives <= 0) {
          finishRun(false);
          return;
        }
        continue;
      }
    }

    if (meteor.y > canvas.height + meteor.radius + 30) {
      meteors.splice(i, 1);
    }
  }
}

function finishRun(win) {
  state.running = false;
  state.gameOver = true;
  const bestScore = Math.max(state.best, state.score);
  state.best = bestScore;
  localStorage.setItem('nova-drift-best', String(bestScore));

  if (win) {
    showOverlay('Mission complete!', `You secured ${state.score} points and escaped the storm. Best score: ${bestScore}.`, 'Play Again');
  } else {
    showOverlay('Mission failed', `You collected ${state.score} points. Reach ${config.goalScore} to win.`, 'Retry');
  }
}

function update(dt) {
  if (!state.running) {
    return;
  }

  state.countdown -= dt;
  if (state.countdown <= 0) {
    finishRun(state.score >= config.goalScore);
    return;
  }

  if (player.invulnerable > 0) {
    player.invulnerable -= dt;
  }

  refreshBackground(dt);
  handleInput(dt);

  state.meteorTimer -= dt;
  if (state.meteorTimer <= 0) {
    createMeteor();
    state.meteorTimer = randomBetween(0.7, 1.4);
  }

  state.crystalTimer -= dt;
  if (state.crystalTimer <= 0) {
    createCrystal();
    state.crystalTimer = randomBetween(1.2, 2.2);
  }

  updateCrystals(dt);
  updateMeteors(dt);
  updateParticles(dt);
  updateHud();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#090f1d');
  sky.addColorStop(1, '#101936');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(110, 173, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (const star of state.backgroundStars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const width = player.width;
  const height = player.height;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = 18;
  ctx.shadowColor = player.invulnerable > 0 ? '#7ef29a' : '#5be4ff';

  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  ctx.beginPath();
  ctx.moveTo(0, -height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.lineTo(0, height / 3);
  ctx.lineTo(-width / 2, height / 2);
  ctx.closePath();
  ctx.fillStyle = '#5be4ff';
  ctx.fill();

  ctx.fillStyle = '#ff5ebc';
  ctx.fillRect(-5, height / 3.5, 10, 12);
  ctx.restore();
}

function drawCrystal(crystal) {
  ctx.save();
  ctx.translate(crystal.x, crystal.y);
  ctx.rotate(performance.now() * 0.003 + crystal.x * 0.01);
  ctx.shadowBlur = 16;
  ctx.shadowColor = crystal.tint;
  ctx.fillStyle = crystal.tint;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    const x = Math.cos(angle) * crystal.radius;
    const y = Math.sin(angle) * crystal.radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMeteor(meteor) {
  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate(meteor.rotation);
  ctx.fillStyle = '#8e9aa8';
  ctx.strokeStyle = '#c6d2df';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const points = 8;
  for (let i = 0; i <= points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const radius = meteor.radius * (0.72 + (Math.sin(i * 2.1) + 1) * 0.18);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life * 1.2, 0, 1);
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawGoalMonitor() {
  const progress = clamp(state.score / config.goalScore, 0, 1);
  const barX = 26;
  const barY = canvas.height - 28;
  const barWidth = canvas.width - 52;
  const barHeight = 10;

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = '#7ef29a';
  ctx.fillRect(barX, barY, barWidth * progress, barHeight);

  ctx.fillStyle = '#dfeafc';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Core target: ${state.score}/${config.goalScore}`, barX, barY - 8);
}

function render() {
  drawBackground();

  for (const crystal of crystals) {
    drawCrystal(crystal);
  }

  for (const meteor of meteors) {
    drawMeteor(meteor);
  }

  drawParticles();
  drawPlayer();
  drawGoalMonitor();
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const dt = clamp((timestamp - state.lastTime) / 1000, 0.016, 0.033);
  state.lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

function startMission() {
  resetGame();
  hideOverlay();
}

function bindInput() {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
      input.left = true;
    }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
      input.right = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
      input.left = false;
    }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
      input.right = false;
    }
  });

  moveButtons.forEach((button) => {
    const direction = button.dataset.direction;
    const press = (active) => {
      if (direction === 'left') input.left = active;
      if (direction === 'right') input.right = active;
    };

    button.addEventListener('pointerdown', () => press(true));
    button.addEventListener('pointerup', () => press(false));
    button.addEventListener('pointerleave', () => press(false));
    button.addEventListener('pointercancel', () => press(false));
  });

  startButton.addEventListener('click', () => {
    startMission();
  });
}

createBackground();
updateHud();
showOverlay('Collect the core crystals', `Grab ${config.goalScore} points before the timer ends. Avoid the meteor storm.`, 'Start Mission');
bindInput();
requestAnimationFrame(loop);
