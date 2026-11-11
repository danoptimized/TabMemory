// Exact process memory needs chrome.processes (Chrome Dev/Canary only).
// On stable Chrome we fall back to each page's JavaScript heap.
const hasProcesses = !!(chrome.processes && chrome.processes.getProcessIdForTab);

function fmt(bytes) {
  if (bytes == null) return null;
  const mb = bytes / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB';
}

async function viaProcesses(tabs) {
  const ids = await Promise.all(tabs.map(t =>
    new Promise(r => chrome.processes.getProcessIdForTab(t.id, r)).catch(() => null)));
  const info = await new Promise(r => chrome.processes.getProcessInfo([], true, r));
  return tabs.map((t, i) => {
    const p = ids[i] != null ? info[ids[i]] : null;
    return p ? p.privateMemory : null;
  });
}

async function viaJsHeap(tabs) {
  return Promise.all(tabs.map(async t => {
    if (t.discarded) return null;
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: t.id },
        world: 'MAIN',
        func: () => performance.memory ? performance.memory.usedJSHeapSize : null,
      });
      return res ? res.result : null;
    } catch { return null; } // chrome:// pages, Web Store, PDFs
  }));
}

async function render() {
  const tabs = await chrome.tabs.query({});
  const mem = hasProcesses ? await viaProcesses(tabs) : await viaJsHeap(tabs);
  const rows = tabs.map((t, i) => ({ tab: t, bytes: mem[i] }))
    .sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1));

  const max = Math.max(1, ...rows.map(r => r.bytes || 0));
  const total = rows.reduce((s, r) => s + (r.bytes || 0), 0);
  document.getElementById('total').textContent = `${tabs.length} tabs · ${fmt(total)}`;
  document.getElementById('note').textContent = hasProcesses
    ? 'Exact per-tab process memory. Tabs sharing a process show the same number.'
    : 'JavaScript memory per tab (rounded by Chrome, so treat it as a rough ranking). Click a row to jump to it.';

  const list = document.getElementById('list');
  list.replaceChildren();
  for (const { tab, bytes } of rows) {
    const li = document.createElement('li');
    li.title = tab.url || '';

    const icon = document.createElement('img');
    icon.src = tab.favIconUrl && tab.favIconUrl.startsWith('http') ? tab.favIconUrl : 'data:,';

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = tab.title || tab.url;

    const memEl = document.createElement('span');
    memEl.className = 'mem' + (bytes == null ? ' na' : '');
    memEl.textContent = tab.discarded ? 'asleep' : (fmt(bytes) ?? 'n/a');

    const sleep = document.createElement('button');
    sleep.textContent = 'Sleep';
    sleep.title = 'Unload this tab to free its memory (it stays open)';
    sleep.disabled = tab.discarded || tab.active;
    sleep.onclick = async e => {
      e.stopPropagation();
      try {
        await chrome.tabs.discard(tab.id);
      } catch {
        sleep.textContent = 'refused'; // e.g. tab is playing audio — Chrome won't discard it
        setTimeout(() => { sleep.textContent = 'Sleep'; }, 1500);
      }
      render();
    };

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = ((bytes || 0) / max * 100) + '%';

    li.onclick = () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    };
    li.append(icon, title, memEl, sleep, bar);
    list.append(li);
  }
}

// Tabs that "Sleep all others" never touches.
const KEEP_HOSTS = ['spotify.com', 'app.folklore.my'];

function isKept(tab) {
  try {
    const host = new URL(tab.url).hostname;
    return KEEP_HOSTS.some(k => host === k || host.endsWith('.' + k));
  } catch { return false; }
}

document.getElementById('sleepAll').onclick = async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter(t => !t.discarded && !t.active && !isKept(t));
  let slept = 0, failed = 0;
  for (const t of targets) {
    try { await chrome.tabs.discard(t.id); slept++; } catch { failed++; }
  }
  btn.textContent = failed ? `Slept ${slept} · ${failed} refused` : `Slept ${slept}`;
  setTimeout(() => { btn.textContent = 'Sleep all others'; btn.disabled = false; }, 2000);
  render();
};

render();
