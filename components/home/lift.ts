/**
 * ONE HOVER BEHAVIOUR FOR THE WHOLE PAGE.
 *
 *   at rest    shadow-resting
 *   on hover   shadow-raised, lifted 2px
 *   on press   back down to resting, no lift — it should feel pressed
 *
 * Written once and shared so the page reads as one system rather than a set
 * of components somebody styled separately.
 *
 * ONLY box-shadow AND transform ARE ANIMATED. Anything else — height, margin,
 * colour on a layout property — makes the browser re-lay-out the page on
 * every mouse move. The colour changes each component already had are kept;
 * they simply are not transitioned.
 *
 * THE STUCK-HOVER BUG ON TOUCH. Tapping a card on iOS leaves :hover applied
 * until you tap elsewhere, so a card sits permanently lifted. Tailwind v4's
 * hover variant is already wrapped in @media (hover: hover), so these rules
 * never apply on a touch screen at all — the active: rules are what fire
 * there, which is exactly the pressed state wanted.
 *
 * REDUCED MOTION keeps the shadow and drops the lift. The shadow is
 * information — it says the thing is interactive; the movement is the part
 * someone asked not to see.
 */
export const LIFT = [
  'transition-[box-shadow,transform] duration-150 ease-out',
  'shadow-resting',
  'hover:shadow-raised hover:-translate-y-0.5',
  // Pressed: down, and no lift, even while the pointer is still over it.
  'active:translate-y-0 active:shadow-resting',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ')

/**
 * The same behaviour for a text link, WITHOUT the shadow.
 *
 * A box-shadow on a run of inline text reads as a bug, not as depth — which
 * is the case docs/DESIGN-SYSTEM.md section 5 already makes for ghost
 * buttons. The lift and the timing are shared so the links still move the
 * same way everything else does.
 */
export const LIFT_TEXT = [
  'transition-transform duration-150 ease-out',
  'hover:-translate-y-0.5 active:translate-y-0',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ')
