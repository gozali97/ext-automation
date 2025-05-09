import { Storage } from "@plasmohq/storage"

console.log("Automation App Extension Background Script Loaded")

// Initialize storage
const storage = new Storage()

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel) {
      // Open sidepanel
      await chrome.sidePanel.open({ windowId: tab.windowId })
      
      // Set sidepanel state
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: "sidepanel.html"
      })
    }
  } catch (error) {
    console.error("Error opening sidepanel:", error)
  }
})

// Set initial state when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  try {
    if (chrome.sidePanel) {
      // Enable sidepanel by default
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: "sidepanel.html"
      })
    }
    
    // Initialize storage with default values if needed
    const config = await storage.get("config")
    if (!config) {
      await storage.set("config", {
        isAuthenticated: false,
        lastChecked: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error("Error initializing extension:", error)
  }
}) 