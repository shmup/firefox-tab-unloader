browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ active: false, currentWindow: true });
  tabs.forEach((tab) => browser.tabs.discard(tab.id));
});
