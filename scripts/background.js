// Background script for Chrome extension

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addTextInput",
    title: "Add selected text to screenshot",
    contexts: ["selection"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addTextInput") {
    // Store selected text
    await chrome.storage.local.set({
      selectedText: info.selectionText,
      tabUrl: tab.url,
      lastAction: "textSelected",
    });

    // Open side panel
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error("Error opening side panel:", error);
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "capture-area") {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "startAreaCapture" });
    } catch (error) {
      console.error("Error sending area capture message:", error);
    }
  } else if (command === "capture-tab") {
    await captureTab(tab);
  }
});

// Capture entire tab
async function captureTab(tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
      quality: 100,
    });

    // Store screenshot data
    const screenshotData = {
      id: Date.now(),
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString(),
      dataUrl: dataUrl,
      type: "full-tab",
    };

    await saveScreenshot(screenshotData);

    // Show notification to user
    chrome.tabs.sendMessage(tab.id, {
      action: "showNotification",
      message: "Full tab screenshot captured! Click the extension icon to view it."
    });

    // Note: Side panel will be opened by user action or content script
  } catch (error) {
    console.error("Error capturing tab:", error);
  }
}

// Save screenshot to local storage
async function saveScreenshot(screenshotData) {
  try {
    const { screenshots = [] } = await chrome.storage.local.get("screenshots");
    screenshots.unshift(screenshotData);

    // Keep only last 50 screenshots
    if (screenshots.length > 50) {
      screenshots.splice(50);
    }

    await chrome.storage.local.set({ screenshots });
  } catch (error) {
    console.error("Error saving screenshot:", error);
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === "captureArea") {
        await captureArea(sender.tab, request.area);
      } else if (request.action === "saveScreenshot") {
        await saveScreenshot(request.data);
      } else if (request.action === "captureTab") {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await captureTab(tabs[0]);
        }
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// Capture specific area
async function captureArea(tab, area) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
      quality: 100,
    });

    // Send to content script for cropping
    await chrome.tabs.sendMessage(tab.id, {
      action: "cropImage",
      dataUrl: dataUrl,
      area: area,
    });
  } catch (error) {
    console.error("Error capturing area:", error);
  }
}
