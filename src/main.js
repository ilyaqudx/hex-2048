import './style.css';
import { Hex2048Engine, HEX_DIRECTIONS } from './hex-engine.js';
import { audio } from './audio.js';

// DOM Elements
const svgBoardEl = document.getElementById('hex-board-svg');
const scoreEl = document.getElementById('score-val');
const bestScoreEl = document.getElementById('best-score-val');
const btnNewGameEl = document.getElementById('btn-new-game');
const btnUndoEl = document.getElementById('btn-undo');
const btnSoundEl = document.getElementById('btn-sound');
const soundIconEl = document.getElementById('sound-icon');
const btnHelpEl = document.getElementById('btn-help');

const modalVictoryEl = document.getElementById('modal-victory');
const modalGameOverEl = document.getElementById('modal-gameover');
const modalHelpEl = document.getElementById('modal-help');
const btnKeepPlayingEl = document.getElementById('btn-keep-playing');
const btnRestartWinEl = document.getElementById('btn-restart-win');
const btnRestartLossEl = document.getElementById('btn-restart-loss');

const modeBtns = document.querySelectorAll('.mode-btn');
const compassBtns = document.querySelectorAll('.compass-btn');

// Game State
let currentRadius = 2; // 2 = 19 cells (Classic), 3 = 37 cells (Expanded)
let engine = new Hex2048Engine(currentRadius);
let bestScore = parseInt(localStorage.getItem(`hex2048_best_${currentRadius}`) || '0', 10);
bestScoreEl.textContent = bestScore.toLocaleString();

// Sound Setup
function updateSoundIcon() {
  soundIconEl.textContent = audio.isMuted() ? '🔇' : '🔊';
}
updateSoundIcon();
btnSoundEl.addEventListener('click', () => {
  audio.toggleMute();
  updateSoundIcon();
});

// Hexagonal Projection Math (Pointy-topped)
// x = size * (sqrt(3)*q + sqrt(3)/2*r)
// y = size * (3/2*r)
function getHexPoints(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return points.join(' ');
}

// Render Board
function renderBoard() {
  svgBoardEl.innerHTML = '';
  const viewBoxSize = 400;
  svgBoardEl.setAttribute('viewBox', `-${viewBoxSize / 2} -${viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`);

  // Determine hex radius size based on board radius
  // With radius 2: width span is (2*radius + 1) * sqrt(3) * size
  const hexSize = currentRadius === 2 ? 38 : 25;

  const coords = engine.getAllCoordinates();

  // 1. Draw empty background slots
  coords.forEach(c => {
    const cx = hexSize * (Math.sqrt(3) * c.q + (Math.sqrt(3) / 2) * c.r);
    const cy = hexSize * (1.5 * c.r);
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', getHexPoints(cx, cy, hexSize - 2));
    polygon.setAttribute('class', 'hex-cell-empty');
    svgBoardEl.appendChild(polygon);
  });

  // 2. Draw active tiles
  coords.forEach(c => {
    const val = engine.cells.get(engine.key(c.q, c.r));
    if (val === 0) return;

    const cx = hexSize * (Math.sqrt(3) * c.q + (Math.sqrt(3) / 2) * c.r);
    const cy = hexSize * (1.5 * c.r);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `hex-tile tile-${val > 8192 ? 8192 : val}`);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', getHexPoints(cx, cy, hexSize - 2));

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx.toFixed(1));
    text.setAttribute('y', cy.toFixed(1));
    text.textContent = val;

    g.appendChild(polygon);
    g.appendChild(text);
    svgBoardEl.appendChild(g);
  });

  // Update Score Displays
  scoreEl.textContent = engine.score.toLocaleString();
  if (engine.score > bestScore) {
    bestScore = engine.score;
    localStorage.setItem(`hex2048_best_${currentRadius}`, bestScore);
    bestScoreEl.textContent = bestScore.toLocaleString();
  }
}

// Action: Handle Slide in Direction
function handleMove(dir) {
  const result = engine.move(dir);
  if (!result.moved) return;

  renderBoard();

  if (result.mergedValues && result.mergedValues.length > 0) {
    const maxMerged = Math.max(...result.mergedValues);
    audio.playMerge(maxMerged);
  } else {
    audio.playSlide();
  }

  if (result.won && !engine.keepPlaying) {
    audio.playWin();
    setTimeout(() => { modalVictoryEl.hidden = false; }, 300);
  } else if (result.over) {
    audio.playGameOver();
    setTimeout(() => { modalGameOverEl.hidden = false; }, 300);
  }
}

// Keyboard Mapping
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  let dir = null;
  const k = e.key.toLowerCase();

  switch (k) {
    // Top-Left (↖)
    case 'q':
    case '7':
      dir = HEX_DIRECTIONS.TOP_LEFT;
      break;
    // Top-Right (↗)
    case 'w':
    case 'e':
    case '9':
      dir = HEX_DIRECTIONS.TOP_RIGHT;
      break;
    // Right (→)
    case 'd':
    case '6':
    case 'arrowright':
      dir = HEX_DIRECTIONS.RIGHT;
      break;
    // Bottom-Right (↘)
    case 'x':
    case 'c':
    case '3':
    case 'arrowdown':
      dir = HEX_DIRECTIONS.BOTTOM_RIGHT;
      break;
    // Bottom-Left (↙)
    case 'z':
    case 's':
    case '1':
      dir = HEX_DIRECTIONS.BOTTOM_LEFT;
      break;
    // Left (←)
    case 'a':
    case '4':
    case 'arrowleft':
      dir = HEX_DIRECTIONS.LEFT;
      break;
    // Up arrow defaults to top-right
    case 'arrowup':
      dir = HEX_DIRECTIONS.TOP_RIGHT;
      break;
    // Undo
    case 'u':
    case 'backspace':
      if (engine.undo()) {
        renderBoard();
        audio.playSlide();
      }
      return;
  }

  if (dir) {
    e.preventDefault();
    handleMove(dir);
  }
});

// Compass D-Pad Buttons
compassBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const dName = btn.dataset.dir;
    const dir = HEX_DIRECTIONS[dName];
    if (dir) handleMove(dir);
  });
});

// Touch and Mouse Swipe Gestures on Board
let touchStartX = 0;
let touchStartY = 0;
const boardWrapper = document.getElementById('board-wrapper');

function onPointerStart(x, y) {
  touchStartX = x;
  touchStartY = y;
}

function onPointerEnd(x, y) {
  const dx = x - touchStartX;
  const dy = y - touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 25) return; // Ignore small taps

  // Angle in radians (-PI to PI)
  const angle = Math.atan2(dy, dx);
  // Compare to the 6 hex direction angles and pick the closest
  let bestDir = null;
  let minDiff = Infinity;

  for (const dir of Object.values(HEX_DIRECTIONS)) {
    let diff = Math.abs(angle - dir.angle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < minDiff) {
      minDiff = diff;
      bestDir = dir;
    }
  }

  if (bestDir) {
    handleMove(bestDir);
  }
}

boardWrapper.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  onPointerStart(t.clientX, t.clientY);
}, { passive: true });

boardWrapper.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  onPointerEnd(t.clientX, t.clientY);
}, { passive: true });

let isMouseDown = false;
boardWrapper.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  onPointerStart(e.clientX, e.clientY);
});
window.addEventListener('mouseup', (e) => {
  if (isMouseDown) {
    isMouseDown = false;
    onPointerEnd(e.clientX, e.clientY);
  }
});

// Undo Button
btnUndoEl.addEventListener('click', () => {
  if (engine.undo()) {
    renderBoard();
    audio.playSlide();
  }
});

// New Game
btnNewGameEl.addEventListener('click', () => {
  engine.initBoard();
  modalVictoryEl.hidden = true;
  modalGameOverEl.hidden = true;
  renderBoard();
});

btnKeepPlayingEl.addEventListener('click', () => {
  engine.keepPlaying = true;
  modalVictoryEl.hidden = true;
});

btnRestartWinEl.addEventListener('click', () => {
  engine.initBoard();
  modalVictoryEl.hidden = true;
  renderBoard();
});

btnRestartLossEl.addEventListener('click', () => {
  engine.initBoard();
  modalGameOverEl.hidden = true;
  renderBoard();
});

// Help Modal
btnHelpEl.addEventListener('click', () => { modalHelpEl.hidden = false; });
document.querySelectorAll('.modal-close').forEach(b => {
  b.addEventListener('click', () => { modalHelpEl.hidden = true; });
});
modalHelpEl.addEventListener('click', (e) => {
  if (e.target === modalHelpEl) modalHelpEl.hidden = true;
});

// Board Mode Selection (Classic / Expanded)
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRadius = parseInt(btn.dataset.radius, 10);
    engine = new Hex2048Engine(currentRadius);
    bestScore = parseInt(localStorage.getItem(`hex2048_best_${currentRadius}`) || '0', 10);
    bestScoreEl.textContent = bestScore.toLocaleString();
    renderBoard();
  });
});

// Initial Render
renderBoard();
