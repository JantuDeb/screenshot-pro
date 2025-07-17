// Popup script for Chrome extension

document.addEventListener("DOMContentLoaded", () => {
  // Capture area button
  document.getElementById("captureArea").addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { action: "startAreaCapture" });
          window.close();
        } catch (contentScriptError) {
          // Inject content script if not already injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['scripts/content.js']
          });
          
          // Wait a bit for injection to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Try again
          await chrome.tabs.sendMessage(tabs[0].id, { action: "startAreaCapture" });
          window.close();
        }
      }
    } catch (error) {
      console.error("Error starting area capture:", error);
    }
  });

  // Capture tab button
  document.getElementById("captureTab").addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({ action: "captureTab" });
      window.close();
    } catch (error) {
      console.error("Error capturing tab:", error);
    }
  });

  // Open sidebar button
  document.getElementById("openSidebar").addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.sidePanel.open({ tabId: tabs[0].id });
        window.close();
      }
    } catch (error) {
      console.error("Error opening sidebar:", error);
    }
  });
});
