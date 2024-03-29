let iconChanged = false;

function resetIconOnTabLoad(_tabId, changeInfo, _tab) {
  if (changeInfo.status === "complete" && iconChanged) {
    browser.browserAction.setIcon({ path: "icons/zoidberg.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad); // remove listener
  }
}

browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false });
  browser.browserAction.setIcon({ path: "icons/noidberg.png" });
  iconChanged = true;
  for (const tab of tabs) {
    await browser.tabs.discard(tab.id);
  }
  browser.tabs.onUpdated.addListener(resetIconOnTabLoad); // add listener
});
