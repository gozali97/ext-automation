// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel) {
    await chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

// Set default side panel state when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: "sidepanel.html"
    })
  }
}) 