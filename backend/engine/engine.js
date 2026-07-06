/**
 * Orchestration engine core.
 * A tick loop advances every active campaign through the pipeline phases:
 *   discovery → research → audit → outreach → followups, then global send queue.
 * All eligibility is derived from persisted status fields — ticks are idempotent
 * and restarts are safe. Phase modules are loaded lazily so the engine core can
 * run before every phase exists.
 */

const { read, write } = require('./store');

const DEFAULT_INTERVAL_MS = 60_000;
const LOG_CAP = 200;

let timer = null;
let ticking = false;
let lastTickSummary = null;

function loadState() {
  const data = read('engine');
  return {
    running: !!data.state?.running,
    intervalMs: data.state?.intervalMs || DEFAULT_INTERVAL_MS,
    lastTickAt: data.state?.lastTickAt || null,
  };
}

function saveState(patch) {
  const data = read('engine');
  data.state = { ...loadState(), ...patch };
  write('engine', data);
  return data.state;
}

function logActivity(level, phase, message, campaignId) {
  const data = read('engine');
  if (!Array.isArray(data.log)) data.log = [];
  data.log.unshift({ at: new Date().toISOString(), level, phase, message, campaignId: campaignId || null });
  data.log = data.log.slice(0, LOG_CAP);
  write('engine', data);
}

function phaseModule(name) {
  try { return require(`./phases/${name}`); } catch { return null; }
}

function schedulerModule() {
  try { return require('./scheduler'); } catch { return null; }
}

async function tick(ctx = {}) {
  if (ticking) return { at: new Date().toISOString(), skipped: 'tick already in progress' };
  ticking = true;
  const actions = [];
  const campaigns = read('campaigns').filter(c => c.status === 'active');

  try {
    for (const campaign of campaigns) {
      for (const name of ['discovery', 'research', 'audit', 'outreach', 'followups']) {
        const mod = phaseModule(name);
        if (!mod) continue;
        try {
          const phaseActions = await mod.run(campaign, ctx);
          for (const a of phaseActions || []) {
            actions.push(`[${campaign.name}] ${a}`);
            logActivity('info', name, a, campaign.id);
          }
        } catch (err) {
          actions.push(`[${campaign.name}] ${name} error: ${err.message}`);
          logActivity('error', name, err.message, campaign.id);
        }
      }
    }

    const scheduler = schedulerModule();
    if (scheduler) {
      try {
        const sendActions = await scheduler.processDueSends(ctx);
        for (const a of sendActions || []) {
          actions.push(a);
          logActivity('info', 'send', a);
        }
      } catch (err) {
        actions.push(`send error: ${err.message}`);
        logActivity('error', 'send', err.message);
      }
    }
  } finally {
    ticking = false;
  }

  const summary = { at: new Date().toISOString(), campaigns: campaigns.length, actions };
  lastTickSummary = summary;
  saveState({ lastTickAt: summary.at });
  return summary;
}

function start(ctx = {}) {
  const state = saveState({ running: true });
  if (timer) clearInterval(timer);
  timer = setInterval(() => { tick(ctx).catch(err => logActivity('error', 'engine', `tick crashed: ${err.message}`)); }, state.intervalMs);
  logActivity('info', 'engine', `Engine started (interval ${Math.round(state.intervalMs / 1000)}s)`);
  return state;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  const state = saveState({ running: false });
  logActivity('info', 'engine', 'Engine stopped');
  return state;
}

function configure(patch, ctx = {}) {
  const allowed = {};
  if (patch.intervalMs) allowed.intervalMs = Math.max(10_000, Number(patch.intervalMs) || DEFAULT_INTERVAL_MS);
  const state = saveState(allowed);
  if (state.running) start(ctx); // re-arm timer with new interval
  return state;
}

function getState() {
  const data = read('engine');
  return {
    ...loadState(),
    loopArmed: !!timer,
    lastTickSummary,
    log: (data.log || []).slice(0, LOG_CAP),
  };
}

/** Resume the loop on server boot if the engine was running before restart. */
function resumeIfRunning(ctx = {}) {
  if (loadState().running) {
    start(ctx);
    logActivity('info', 'engine', 'Engine resumed after server restart');
  }
}

module.exports = { tick, start, stop, configure, getState, resumeIfRunning, logActivity };
