# Tab Memory

A Chrome MV3 extension that lists open tabs by memory use, biggest first, and
auto-sleeps idle background tabs.

## What it does

- **Popup:** shows every open tab with its memory footprint, sorted biggest
  first. Exact per-tab process memory needs the `chrome.processes` API
  (Chrome Dev/Canary only); on stable Chrome it falls back to each page's
  JavaScript heap via `performance.memory`.
- **Auto-sleep:** a service worker sweep runs every 5 minutes (via
  `chrome.alarms`) and discards background tabs idle for 30+ minutes.

Tabs that are never put to sleep: the active tab, audible tabs (playing
audio), pinned tabs, and hosts in `KEEP_HOSTS` (currently `spotify.com` and
`app.folklore.my` — edit that list in `background.js`; keep the copy in
`popup.js` in sync).

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.

## Files

- `manifest.json` — MV3 manifest; permissions `tabs`, `scripting`, `processes`, `alarms`.
- `background.js` — the idle-tab sweep and keep-list.
- `popup.html` / `popup.js` — the memory table UI and manual sweep.
