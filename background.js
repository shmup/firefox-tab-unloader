let iconChanged = false;

function resetIconOnTabLoad(_tabId, changeInfo, _tab) {
  if (changeInfo.status === "complete" && iconChanged) {
    browser.action.setIcon({ path: "icons/zoidberg.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad);
  }
}

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false });
  browser.action.setIcon({ path: "icons/voidberg.png" });
  iconChanged = true;
  for (const tab of tabs) {
    await browser.tabs.discard(tab.id);
  }
  browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
});
