browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false, currentWindow: true });
  if (tabs.length > 0) {
    for (const tab of tabs) {
      await browser.tabs.discard(tab.id);
    }
    browser.browserAction.setIcon({ path: "icons/nosmurf.png" });
  }
});
