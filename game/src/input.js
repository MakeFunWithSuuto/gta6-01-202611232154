// Keyboard and mouse: which keys are held, which were pressed since the last frame, and where the
// mouse points on the canvas (in CSS pixels) with its button state.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (event) => { mouse.x = event.offsetX; mouse.y = event.offsetY; });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (event) => { if (event.button === 0) mouse.down = false; });
  canvas.addEventListener('wheel', (event) => { mouse.wheel += Math.sign(event.deltaY); event.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    isDown: (code) => held.has(code),
    wasPressed: (code) => pressed.has(code),
    /** Axis from two keys (and their arrow twins): -1, 0 or 1. */
    axis(negative, positive) {
      return (positive.some((c) => held.has(c)) ? 1 : 0) - (negative.some((c) => held.has(c)) ? 1 : 0);
    },
    endFrame() { pressed.clear(); mouse.clicked = false; mouse.wheel = 0; },
  };
}
