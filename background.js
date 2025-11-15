let iconChanged = false;

function resetIconOnTabLoad(_tabId, changeInfo, tab) {
  if (changeInfo.status === "loading" && !tab.discarded && iconChanged) {
    browser.action.setIcon({ path: "icons/zoidberg.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad);
  }
}

async function getTabStats() {
  const tabs = await browser.tabs.query({});
  const loadedTabs = tabs.filter(tab => !tab.discarded);
  return { total: tabs.length, loaded: loadedTabs.length };
}

async function updateContextMenu() {
  const stats = await getTabStats();
  await browser.menus.update("tab-stats", {
    title: `${stats.loaded}/${stats.total} tabs loaded`
  });
  await browser.menus.refresh();
}

// create context menu items on install/startup
async function createContextMenus() {
  try {
    await browser.menus.removeAll();

    browser.menus.create({
      id: "tab-stats",
      title: "loading...",
      contexts: ["action"],
      enabled: false
    });

    browser.menus.create({
      id: "unload-all-but-recent",
      title: "unload all but last 10 active tabs",
      contexts: ["action"]
    });
  } catch (e) {
    console.error("Error creating context menus:", e);
  }
}

// create menus on install and on startup
browser.runtime.onInstalled.addListener(createContextMenus);
browser.runtime.onStartup.addListener(createContextMenus);

browser.menus.onShown.addListener(async () => {
  await updateContextMenu();
});

// update stats when tabs are discarded or restored
browser.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.discarded !== undefined) {
    await updateContextMenu();
  }
});

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "unload-all-but-recent") {
    const tabs = await browser.tabs.query({});
    tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    const tabsToUnload = tabs.slice(10);

    browser.action.setIcon({ path: "icons/voidberg.png" });
    iconChanged = true;

    for (const tab of tabsToUnload) {
      if (!tab.active && !tab.discarded) {
        await browser.tabs.discard(tab.id);
      }
    }

    browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
  }
});

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false });
  browser.action.setIcon({ path: "icons/voidberg.png" });
  iconChanged = true;
  for (const tab of tabs) {
    await browser.tabs.discard(tab.id);
  }
  browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
});
