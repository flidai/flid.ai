// Shared by everything drawn on a canvas. Importing it changes nothing on the page.
const SLOW = 25, FAST = 20, WINDOW = 30, STEP = 0.8, RESIZE_HEIGHT = 120, POINTER_EASE = 325;

// Gives up resolution before smoothness, judged on the average frame time over 30 frames.
// Frame times alone cannot tell a slow GPU from a screen capped at 30 frames a second (Low Power
// Mode, a 30 Hz monitor), so the first slow window tries the lowest resolution. If that does not
// help, resolution was never the problem: it goes back to full and stays there.
export function createResolution({ start, min, onChange }) {
  let value = start, total = 0, frames = 0, fast = 0, patience = 4;
  let probe = null, probed = false, raised = false, locked = false;
  const set = (next) => { value = next; onChange(value); };

  const judge = (average) => {
    if (locked) return;
    if (probe) {
      if (average >= probe.average * 0.9) { locked = true; set(probe.value); }
      probe = null;
      return;
    }
    if (average > SLOW) {
      fast = 0;
      if (value <= min) return;
      if (!probed) {
        probed = true;
        probe = { value, average };
        set(min);
        return;
      }
      // A step up that turned out too much: wait longer before the next one.
      if (raised) patience *= 2;
      raised = false;
      set(Math.max(min, value * STEP));
    } else if (average < FAST && value < start) {
      fast += 1;
      if (fast < patience) return;
      fast = 0;
      raised = true;
      set(Math.min(start, value / STEP));
    } else {
      fast = 0;
    }
  };

  return {
    get value() { return value; },
    frame(delta) {
      total += delta; frames += 1;
      if (frames < WINDOW) return;
      const average = total / frames;
      total = 0; frames = 0;
      judge(average);
    },
  };
}

// A phone's address bar sliding away is not worth reallocating a canvas.
export const worthResizing = (width, height, lastWidth, lastHeight) =>
  width !== lastWidth || Math.abs(height - lastHeight) >= RESIZE_HEIGHT;

// The pointer as -1 to 1 across the window, eased by time so every refresh rate feels the same.
export function createPointer(still = false) {
  let targetX = 0, targetY = 0;
  const pointer = {
    x: 0,
    y: 0,
    ease(delta) {
      const amount = 1 - Math.exp(-delta / POINTER_EASE);
      pointer.x += (targetX - pointer.x) * amount;
      pointer.y += (targetY - pointer.y) * amount;
    },
  };
  if (!still) addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    targetX = (event.clientX / innerWidth) * 2 - 1;
    targetY = (event.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  return pointer;
}
