const { allocateUnassigned } = require('./allocate');

const state = {
  enabled: true, intervalMinutes: 0, running: false,
  lastRun: null, lastResult: null, totalAutoAssigned: 0,
};
let timer = null;

async function run(trigger = 'schedule') {
  if (state.running) return state.lastResult;
  state.running = true;
  try {
    const r = await allocateUnassigned({ auto: true });
    state.lastRun = new Date();
    state.lastResult = { trigger, assigned: r.assigned.length, stillUnassigned: r.unassigned.length };
    state.totalAutoAssigned += r.assigned.length;
    if (r.assigned.length) console.log(`[automation] ${trigger}: assigned ${r.assigned.length} task(s)`);
    return { ...state.lastResult, details: r };
  } finally { state.running = false; }
}

/** Background job: allocate new work every N minutes while enabled. */
function start(minutes) {
  stop();
  state.intervalMinutes = Number(minutes) || 0;
  if (state.intervalMinutes <= 0) return;
  timer = setInterval(() => { if (state.enabled) run('schedule').catch((e) => console.error('[automation]', e.message)); }, state.intervalMinutes * 60000);
  timer.unref?.();
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { state, run, start, stop };
