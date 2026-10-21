// Placement of the floating chat HUD. Plain functions over DOMRect-like objects, no DOM access.
const HEADER_MAX_HEIGHT = 140;
const GAP = 12;

const encloses = (outer, inner) =>
  outer.width > 0 && outer.height > 0 &&
  outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom;

/**
 * Where the floating HUD goes: the top-left corner of the middle chat column, under the
 * session header (title row and Chat/Trajectory tabs), where the message column leaves space.
 * `chain` holds the rects of the button and its ancestors, innermost first. Only ancestors
 * that really enclose the button count. Wrappers with no size (display: contents, a 0-high
 * shell at the window corner) are skipped, so the window corner is never picked.
 * - header: the outermost enclosing ancestor at most 140 px high.
 * - column: the first enclosing ancestor taller than that, i.e. the chat column.
 * Null while the button is not shown or no header encloses it.
 */
export function anchorFor(chain) {
  const [button] = chain;
  if (!button || button.width === 0 || button.height === 0) return null;
  let header = null;
  let column = null;
  for (const rect of chain.slice(1)) {
    if (!encloses(rect, button)) continue;
    if (rect.height <= HEADER_MAX_HEIGHT) header = rect;
    else { column = rect; break; }
  }
  if (!header) return null;
  const left = Math.max(header.left, column?.left ?? header.left);
  return { top: Math.round(header.bottom + GAP), left: Math.round(left + GAP) };
}
