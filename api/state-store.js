const states = new Map();

export function saveState(state) {
  // expire in 10 minutes
  states.set(state, Date.now() + 10 * 60 * 1000);
}

export function verifyState(state) {
  const expire = states.get(state);
  // remove state regardless of validity to prevent replay
  states.delete(state);
  return Boolean(expire && expire > Date.now());
}
