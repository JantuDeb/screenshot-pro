// Sidebar script for Chrome extension

let currentTab = null;
let screenshots = [];

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Get current tab info
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  document.getElementById("currentUrl").textContent = currentTab.url;

    // Load stored data
    
  await loadStoredData();

  // Load screenshots
  await loadScreenshots();

  // Set up event listeners
  setupEventListeners();
});

async function loadStoredData() {
  const data = await chrome.storage.local.get([
    "selectedText",
    "apiEndpoint",
    "lastAction",
  ]);

  if (data.selectedText && data.lastAction === "textSelected") {
    document.getElementById("textInput").value = data.selectedText;
    // Clear selected text after loading
    chrome.storage.local.remove(["selectedText", "lastAction"]);
  }

  if (data.apiEndpoint) {
    document.getElementById("apiEndpoint").value = data.apiEndpoint;
  }
}

async function loadScreenshots() {
  const data = await chrome.storage.local.get("screenshots");
  screenshots = data.screenshots || [];
  renderScreenshots();
}

function renderScreenshots() {
  const container = document.getElementById("screenshotsList");

  if (screenshots.length === 0) {
    container.innerHTML =
      '<div class="text-center py-10 text-muted-foreground">No screenshots yet. Capture your first screenshot!</div>';
    return;
  }

  container.innerHTML = screenshots
    .map(
      (screenshot) => `
    <div class="border border-border rounded-lg mb-3 overflow-hidden">
      <img src="${
        screenshot.dataUrl
      }" alt="Screenshot" class="w-full h-32 object-cover cursor-pointer" data-action="fullscreen" data-id="${
        screenshot.id
      }">
      <div class="p-3 bg-muted/50 text-sm text-muted-foreground">
        <div class="font-medium text-foreground">${screenshot.title}</div>
        <div class="text-xs mt-1">${new Date(screenshot.timestamp).toLocaleString()}</div>
        <div class="text-xs">Type: ${screenshot.type}</div>
        <div class="flex gap-2 mt-2">
          <button data-action="download" data-id="${
            screenshot.id
          }" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/80">Download</button>
          <button data-action="copy" data-id="${screenshot.id}" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/80">Copy</button>
          <button data-action="delete" data-id="${
            screenshot.id
          }" class="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs hover:bg-destructive/80">Delete</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function setupEventListeners() {
  // Capture buttons
  document.getElementById("captureArea").addEventListener("click", async () => {
    try {
      try {
        await chrome.tabs.sendMessage(currentTab.id, { action: "startAreaCapture" });
      } catch (contentScriptError) {
        // Inject content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['scripts/content.js']
        });
        
        // Wait a bit for injection to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try again
        await chrome.tabs.sendMessage(currentTab.id, { action: "startAreaCapture" });
      }
    } catch (error) {
      console.error("Error starting area capture:", error);
    }
  });

  document.getElementById("captureTab").addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({ action: "captureTab", tabId: currentTab.id });
    } catch (error) {
      console.error("Error capturing tab:", error);
    }
  });

  // Submit to API
  document.getElementById("submitToApi").addEventListener("click", submitToApi);

  // Save API endpoint
  document.getElementById("apiEndpoint").addEventListener("input", (e) => {
    chrome.storage.local.set({ apiEndpoint: e.target.value });
  });

  // Event delegation for screenshot actions
  document.getElementById("screenshotsList").addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    
    if (action && id) {
      switch (action) {
        case "fullscreen":
          openFullscreen(id);
          break;
        case "download":
          downloadScreenshot(id);
          break;
        case "copy":
          copyToClipboard(id);
          break;
        case "delete":
          deleteScreenshot(id);
          break;
      }
    }
  });

  // Listen for new screenshots and storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.screenshots) {
      loadScreenshots();
    }
    if (changes.selectedText && changes.lastAction) {
      loadStoredData();
    }
  });
}

async function submitToApi() {
  const endpoint = document.getElementById("apiEndpoint").value;
  const textInput = document.getElementById("textInput").value;
  const statusDiv = document.getElementById("statusMessage");

  if (!endpoint) {
    showStatus("Please enter an API endpoint", "error");
    return;
  }

  if (screenshots.length === 0) {
    showStatus("No screenshots to submit", "error");
    return;
  }

  try {
    const latestScreenshot = screenshots[0];
    const payload = {
      url: currentTab.url,
      title: currentTab.title,
      timestamp: new Date().toISOString(),
      textInput: textInput,
      screenshot: {
        id: latestScreenshot.id,
        dataUrl: latestScreenshot.dataUrl,
        type: latestScreenshot.type,
        area: latestScreenshot.area,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      showStatus("Successfully submitted to API", "success");
      document.getElementById("textInput").value = "";
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    showStatus(`Error submitting to API: ${error.message}`, "error");
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById("statusMessage");
  statusDiv.textContent = message;
  
  // Apply Tailwind classes based on type
  if (type === "success") {
    statusDiv.className = "p-3 rounded-md bg-green-50 text-green-800 border border-green-200 text-sm";
  } else if (type === "error") {
    statusDiv.className = "p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm";
  }

  setTimeout(() => {
    statusDiv.textContent = "";
    statusDiv.className = "";
  }, 5000);
}

function openFullscreen(screenshotId) {
  const screenshot = screenshots.find((s) => s.id.toString() === screenshotId);
  if (screenshot) {
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head><title>Screenshot - ${screenshot.title}</title></head>
        <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
          <img src="${screenshot.dataUrl}" style="max-width:100%; max-height:100vh; object-fit:contain;">
        </body>
      </html>
    `);
  }
}

function downloadScreenshot(screenshotId) {
  const screenshot = screenshots.find((s) => s.id.toString() === screenshotId);
  if (screenshot) {
    const link = document.createElement("a");
    link.download = `screenshot-${screenshot.id}.png`;
    link.href = screenshot.dataUrl;
    link.click();
  }
}

async function copyToClipboard(screenshotId) {
  const screenshot = screenshots.find((s) => s.id.toString() === screenshotId);
  if (screenshot) {
    try {
      // Convert data URL to blob
      const response = await fetch(screenshot.dataUrl);
      const blob = await response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      showStatus("Screenshot copied to clipboard", "success");
    } catch (error) {
      showStatus("Error copying to clipboard", "error");
    }
  }
}

async function deleteScreenshot(screenshotId) {
  if (confirm("Are you sure you want to delete this screenshot?")) {
    screenshots = screenshots.filter((s) => s.id.toString() !== screenshotId);
    await chrome.storage.local.set({ screenshots });
    renderScreenshots();
    showStatus("Screenshot deleted", "success");
  }
}
