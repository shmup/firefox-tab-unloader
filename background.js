let iconChanged = false;

function resetIconOnTabLoad(_tabId, changeInfo, _tab) {
  if (changeInfo.status === "complete" && iconChanged) {
    browser.browserAction.setIcon({ path: "icons/smurf.png" });
    iconChanged = false;
    browser.tabs.onUpdated.removeListener(resetIconOnTabLoad);
  }
}

browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false, currentWindow: true });
  if (tabs.length > 0) {
    browser.browserAction.setIcon({ path: "icons/nosmurf.png" });
    iconChanged = true;
    for (const tab of tabs) {
      await browser.tabs.discard(tab.id);
    }
    browser.tabs.onUpdated.addListener(resetIconOnTabLoad);
  }
});
