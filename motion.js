const clamp01 = value => Math.min(1, Math.max(0, value));
export const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
export const nearestAngle = (current, target) => current + Math.atan2(Math.sin(target - current), Math.cos(target - current));

// Analytic critically damped spring: identical timing at 30/60/120 Hz,
// no elastic bounce, and immediate settling when reduced motion is enabled.
export function springStep(state, target, dt, frequency = 12, immediate = false) {
  if (immediate) { state.value = target; state.velocity = 0; return false; }
  const x = state.value - target, v = state.velocity;
  const decay = Math.exp(-frequency * dt), impulse = v + frequency * x;
  state.value = target + (x + impulse * dt) * decay;
  state.velocity = (v - frequency * impulse * dt) * decay;
  const active = Math.abs(state.value - target) + Math.abs(state.velocity) > .0001;
  if (!active) { state.value = target; state.velocity = 0; }
  return active;
}

export function releaseTravel(velocity, ageMs) {
  // A short coast, not an uncontrolled spin; pausing before release stops it.
  return ageMs > 90 ? 0 : Math.max(-.28, Math.min(.28, velocity * .055));
}

export function portalState(progress) {
  const p = clamp01(progress);
  return {blend: smooth((p - .24) / .48), zoom: smooth(p / .72), reveal: smooth((p - .24) / .76)};
}
