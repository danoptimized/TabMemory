// Auto-sleeps background tabs that have been idle for a while.
// Runs on its own via chrome.alarms — the popup is only needed for a manual sweep.
//
// KEEP_HOSTS must stay in sync with the copy in popup.js.

const IDLE_MINUTES = 30;        // sleep a tab after this long without being viewed
const CHECK_EVERY_MINUTES = 5;  // how often the sweep runs
const KEEP_HOSTS = ['spotify.com', 'app.folklore.my'];

function isKept(tab) {
  try {
    const host = new URL(tab.url).hostname;
    return KEEP_HOSTS.some(k => host === k || host.endsWith('.' + k));
  } catch { return false; }
}

function shouldSleep(tab, now) {
  if (tab.active || tab.discarded) return false; // the tab being looked at stays awake
  if (tab.audible) return false;                 // playing audio; Chrome refuses anyway
  if (tab.pinned) return false;                  // treat pinned tabs as deliberately kept
  if (isKept(tab)) return false;
  const idleMs = tab.lastAccessed ? now - tab.lastAccessed : null;
  return idleMs != null && idleMs >= IDLE_MINUTES * 60_000;
}

async function sweep() {
  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  let slept = 0, failed = 0;
  for (const t of tabs) {
    if (!shouldSleep(t, now)) continue;
    try {
      await chrome.tabs.discard(t.id);
      slept++;
    } catch { failed++; }
  }
  if (slept || failed) console.log(`auto-sleep: slept ${slept}, refused ${failed}`);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sweep', { periodInMinutes: CHECK_EVERY_MINUTES });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('sweep', { periodInMinutes: CHECK_EVERY_MINUTES });
});
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'sweep') sweep();
});
