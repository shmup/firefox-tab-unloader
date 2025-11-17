// @ts-nocheck

let iconChanged = false;
let autoUnloadPatterns = new Set();

function resetIconOnTabLoad(_tabId, changeInfo, tab) {
  if (changeInfo.status === "loading" && !tab.discarded && iconChanged) {
    browser.action.setIcon({ path: "icons/zoidberg.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad);
  }
}

function changeIconToUnloadedState() {
  browser.action.setIcon({ path: "icons/voidberg.png" });
  iconChanged = true;
  browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
}

async function discardTabs(tabIds) {
  if (tabIds.length > 0) {
    browser.action.setIcon({ path: "icons/waitberg.png" });
    await browser.tabs.discard(tabIds).catch(() => {});
    changeIconToUnloadedState();
  }
}

function isDiscardable(tab) {
  // filter out about:, moz-extension:, and other internal firefox pages
  return tab.url && !tab.url.startsWith("about:") && !tab.url.startsWith("moz-extension:");
}

async function getTabStats() {
  const tabs = await browser.tabs.query({});
  const discardableTabs = tabs.filter(isDiscardable);
  const loadedTabs = discardableTabs.filter(tab => !tab.discarded && tab.status === "complete");
  const loadingTabs = discardableTabs.filter(tab => !tab.discarded && tab.status === "loading");
  return {
    total: discardableTabs.length,
    loaded: loadedTabs.length,
    loading: loadingTabs.length
  };
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

async function updateContextMenu(info, tab) {
  const stats = await getTabStats();
  const loadingText = stats.loading > 0 ? ` (${stats.loading} loading)` : "";

  // update toolbar button context menu items
  await browser.menus.update("tab-stats", {
    title: `${stats.loaded}/${stats.total} tabs loaded${loadingText}`
  });

  // disable "unload all but recent" when voidberg is showing (nothing to unload)
  const hasLoadedTabs = stats.loaded > 1;
  await browser.menus.update("unload-all-but-recent", {
    enabled: hasLoadedTabs
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

      // update toolbar button menu
      await browser.menus.update("auto-unload-toggle", {
        checked: isEnabled,
        title: `always unload ${hostname} when unfocused`
      });

      // update tab context menu
      await browser.menus.update("tab-auto-unload-toggle", {
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

    // toolbar button context menu
    browser.menus.create({
      id: "tab-stats",
      title: "loading...",
      contexts: ["action"],
      enabled: false
    });

    browser.menus.create({
      id: "unload-current-tab",
      title: "unload current tab",
      contexts: ["action"]
    });

    browser.menus.create({
      id: "unload-all-but-recent",
      title: "unload all but last 10 active tabs",
      contexts: ["action"]
    });

    browser.menus.create({
      type: "separator",
      contexts: ["action"]
    });

    // load stored patterns
    const { patterns } = await browser.storage.local.get({ patterns: [] });
    autoUnloadPatterns = new Set(patterns);

    browser.menus.create({
      id: "auto-unload-toggle",
      type: "checkbox",
      title: "always unload when unfocused",
      contexts: ["action"],
      checked: false
    });

    // tab context menu (right-click on tab bar)
    browser.menus.create({
      id: "tab-unloader-parent",
      title: "Tab Unloader",
      contexts: ["tab"]
    });

    browser.menus.create({
      id: "tab-unload-all-others",
      title: "unload all other tabs",
      contexts: ["tab"],
      parentId: "tab-unloader-parent"
    });

    browser.menus.create({
      id: "tab-auto-unload-toggle",
      type: "checkbox",
      title: "always unload when unfocused",
      contexts: ["tab"],
      parentId: "tab-unloader-parent",
      checked: false
    });
  } catch (e) {
    console.error("Error creating context menus:", e);
  }
}

// create menus on startup
browser.runtime.onStartup.addListener(async () => {
  await createContextMenus();
  await browser.action.setTitle({ title: "Click to unload all other tabs" });
});

browser.menus.onShown.addListener(async (info, tab) => {
  await updateContextMenu(info, tab);
});

async function unloadInactiveTabs() {
  const tabs = await browser.tabs.query({ active: false });
  const tabIds = tabs.filter(tab => !tab.discarded && isDiscardable(tab)).map(tab => tab.id);
  await discardTabs(tabIds);
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
    await browser.tabs.discard(tabIds).catch(() => {});
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "unload-all-but-recent") {
    const tabs = await browser.tabs.query({});
    const discardableTabs = tabs.filter(isDiscardable);
    discardableTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    const tabsToUnload = discardableTabs.slice(10);
    const tabIds = tabsToUnload
      .filter(tab => !tab.active && !tab.discarded)
      .map(tab => tab.id);

    await discardTabs(tabIds);
  } else if (info.menuItemId === "auto-unload-toggle" || info.menuItemId === "tab-auto-unload-toggle") {
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
  } else if (info.menuItemId === "unload-current-tab") {
    const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (currentTab && !currentTab.discarded) {
      const tabs = await browser.tabs.query({ windowId: currentTab.windowId });
      const currentIndex = tabs.findIndex(t => t.id === currentTab.id);
      let nextIndex = (currentIndex + 1) % tabs.length;
      while (tabs[nextIndex].discarded && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % tabs.length;
      }
      if (nextIndex !== currentIndex) {
        await browser.tabs.update(tabs[nextIndex].id, { active: true });
      }
      await browser.tabs.discard(currentTab.id).catch(() => {});
    }
  } else if (info.menuItemId === "tab-unload-all-others") {
    // unload all tabs except the clicked one
    if (tab) {
      const tabs = await browser.tabs.query({ windowId: tab.windowId });
      const tabIds = tabs
        .filter(t => t.id !== tab.id && !t.discarded && isDiscardable(t))
        .map(t => t.id);

      await discardTabs(tabIds);
    }
  }
});

browser.action.onClicked.addListener(unloadInactiveTabs);
