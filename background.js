let iconChanged = false;
let autoUnloadPatterns = new Set();
let cachedStats = null;

function resetIconOnTabLoad(_tabId, changeInfo, tab) {
  if (changeInfo.status === "loading" && !tab.discarded && iconChanged) {
    browser.action.setIcon({ path: "icons/zoidberg.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad);
  }
}

async function getTabStats() {
  if (!cachedStats) {
    const tabs = await browser.tabs.query({});
    const loadedTabs = tabs.filter(tab => !tab.discarded && tab.status === "complete");
    const loadingTabs = tabs.filter(tab => !tab.discarded && tab.status === "loading");
    cachedStats = {
      total: tabs.length,
      loaded: loadedTabs.length,
      loading: loadingTabs.length
    };
  }
  return cachedStats;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

async function updateContextMenu(info, tab) {
  // show updating status if cache is stale
  if (!cachedStats) {
    await browser.menus.update("tab-stats", {
      title: `tabs loaded (updating)`
    });
    await browser.menus.refresh();
  }

  const stats = await getTabStats();
  const loadingText = stats.loading > 0 ? ` (${stats.loading} loading)` : "";
  await browser.menus.update("tab-stats", {
    title: `${stats.loaded}/${stats.total} tabs loaded${loadingText}`
  });

  // if no tab provided (e.g., right-click on toolbar button), get active tab
  if (!tab) {
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    tab = activeTabs[0];
  }

  // update checkbox state based on current tab's hostname
  if (tab && tab.url) {
    const hostname = getHostname(tab.url);
    if (hostname) {
      const isEnabled = autoUnloadPatterns.has(hostname);
      await browser.menus.update("auto-unload-toggle", {
        checked: isEnabled,
        title: `always unload ${hostname} when unfocused`
      });
    }
  }

  await browser.menus.refresh();
}

// create context menu items on install/startup
async function createContextMenus() {
  try {
    await browser.menus.removeAll();

    browser.menus.create({
      id: "tab-stats",
      title: "loading...",
      contexts: ["action", "tab"],
      enabled: false
    });

    browser.menus.create({
      id: "unload-all-but-recent",
      title: "unload all but last 10 active tabs",
      contexts: ["action"]
    });

    browser.menus.create({
      type: "separator",
      contexts: ["action", "tab"]
    });

    // load stored patterns
    const { patterns } = await browser.storage.local.get({ patterns: [] });
    autoUnloadPatterns = new Set(patterns);

    browser.menus.create({
      id: "auto-unload-toggle",
      type: "checkbox",
      title: "always unload when unfocused",
      contexts: ["action", "tab"],
      checked: false
    });
  } catch (e) {
    console.error("Error creating context menus:", e);
  }
}

// create menus on install and on startup
browser.runtime.onInstalled.addListener(createContextMenus);
browser.runtime.onStartup.addListener(createContextMenus);

browser.menus.onShown.addListener(async (info, tab) => {
  await updateContextMenu(info, tab);
});

// invalidate cache when tabs are discarded/restored or status changes
browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.discarded !== undefined || changeInfo.status !== undefined) {
    cachedStats = null;
  }
});

async function unloadInactiveTabs() {
  const tabs = await browser.tabs.query({ active: false });
  const tabIds = tabs.filter(tab => !tab.discarded).map(tab => tab.id);

  if (tabIds.length > 0) {
    browser.action.setIcon({ path: "icons/voidberg.png" });
    iconChanged = true;
    try {
      await browser.tabs.discard(tabIds);
    } catch (e) {
      // discard fails on loading tabs
    }
    browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
  }
}

// when switching tabs, unload the previous tab if its hostname matches patterns
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const allTabs = await browser.tabs.query({ windowId: activeInfo.windowId });
  const tabIds = allTabs
    .filter(tab =>
      tab.id !== activeInfo.tabId &&
      !tab.discarded &&
      tab.url &&
      autoUnloadPatterns.has(getHostname(tab.url))
    )
    .map(tab => tab.id);

  if (tabIds.length > 0) {
    try {
      await browser.tabs.discard(tabIds);
    } catch (e) {
      // discard fails on loading tabs
    }
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "unload-all-but-recent") {
    const tabs = await browser.tabs.query({});
    tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    const tabsToUnload = tabs.slice(10);
    const tabIds = tabsToUnload
      .filter(tab => !tab.active && !tab.discarded)
      .map(tab => tab.id);

    if (tabIds.length > 0) {
      browser.action.setIcon({ path: "icons/voidberg.png" });
      iconChanged = true;
      try {
        await browser.tabs.discard(tabIds);
      } catch (e) {
        // discard fails on loading tabs
      }
      browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
    }
  } else if (info.menuItemId === "auto-unload-toggle") {
    if (tab && tab.url) {
      const hostname = getHostname(tab.url);
      if (hostname) {
        if (info.checked) {
          autoUnloadPatterns.add(hostname);
        } else {
          autoUnloadPatterns.delete(hostname);
        }
        await browser.storage.local.set({ patterns: Array.from(autoUnloadPatterns) });
      }
    }
  }
});

browser.action.onClicked.addListener(unloadInactiveTabs);
