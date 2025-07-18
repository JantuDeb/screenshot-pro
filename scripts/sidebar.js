// Sidebar script for Chrome extension

let currentTab = null;
let allScreenshots = []; // Store all screenshots
let screenshots = []; // Store filtered screenshots
let annotationMode = null;
let selectedScreenshot = null;
let savedTexts = [];
let allSavedTexts = []; // Store all saved texts
let currentFilter = "all"; // Current filter mode

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Get current tab info
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  document.getElementById("currentUrl").textContent = currentTab.url;

  // Load stored data

  await loadStoredData();

  // Load filter preference
  await loadFilterPreference();

  // Load screenshots
  await loadScreenshots();

  // Load saved texts
  await loadSavedTexts();

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
  const data = await chrome.storage.local.get(["screenshots"]);
  allScreenshots = data.screenshots || [];

  // Apply current filter
  applyScreenshotFilter();

  renderScreenshots();
}

async function loadSavedTexts() {
  const data = await chrome.storage.local.get(["savedTexts"]);
  allSavedTexts = data.savedTexts || [];

  // Apply current filter
  applySavedTextsFilter();

  renderSavedTexts();
}

function renderScreenshots() {
  const container = document.getElementById("screenshotsList");

  if (screenshots.length === 0) {
    let message;
    if (currentFilter === "domain") {
      message =
        "No screenshots for this domain yet. Capture your first screenshot or change filter to 'All'!";
    } else {
      message = "No screenshots yet. Capture your first screenshot!";
    }
    container.innerHTML = `<div class="text-center py-10 text-muted-foreground">${message}</div>`;
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
        <div class="text-xs mt-1">${new Date(
          screenshot.timestamp
        ).toLocaleString()}</div>
        <div class="text-xs">Type: ${screenshot.type}</div>
        <div class="flex gap-2 mt-2">
          <button data-action="annotate" data-id="${
            screenshot.id
          }" class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700">Annotate</button>
          <button data-action="download" data-id="${
            screenshot.id
          }" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/80">Download</button>
          <button data-action="copy" data-id="${
            screenshot.id
          }" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/80">Copy</button>
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

function renderSavedTexts() {
  const container = document.getElementById("savedTextsList");

  if (savedTexts.length === 0) {
    let message;
    if (currentFilter === "domain") {
      message =
        "No saved texts for this domain yet. Save your first text note!";
    } else {
      message = "No saved texts yet. Save your first text note!";
    }
    container.innerHTML = `<div class="text-center py-6 text-muted-foreground text-xs">${message}</div>`;
    return;
  }

  container.innerHTML = savedTexts
    .map(
      (text) => `
      <div class="border border-border rounded-lg p-3 mb-2 bg-background">
        <div class="text-sm text-foreground mb-2 line-clamp-3">${
          text.content
        }</div>
        <div class="text-xs text-muted-foreground mb-2">${new Date(
          text.timestamp
        ).toLocaleString()}</div>
        <div class="flex gap-2">
          <button data-action="copyText" data-id="${
            text.id
          }" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/80">Copy</button>
          <button data-action="editText" data-id="${
            text.id
          }" class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-highlight">Edit</button>
          <button data-action="deleteText" data-id="${
            text.id
          }" class="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs hover:bg-destructive/80">Delete</button>
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
        await chrome.tabs.sendMessage(currentTab.id, {
          action: "startAreaCapture",
        });
      } catch (contentScriptError) {
        // Inject content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ["scripts/content.js"],
        });

        // Wait a bit for injection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Try again
        await chrome.tabs.sendMessage(currentTab.id, {
          action: "startAreaCapture",
        });
      }
    } catch (error) {
      console.error("Error starting area capture:", error);
    }
  });

  document.getElementById("captureTab").addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "captureTab",
        tabId: currentTab.id,
      });
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

  // Text note management
  document
    .getElementById("saveTextNote")
    .addEventListener("click", saveTextNote);
  document.getElementById("clearTextInput").addEventListener("click", () => {
    document.getElementById("textInput").value = "";
  });

  // Filter dropdown event listeners
  document.getElementById("filterDropdown").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = e.currentTarget.parentElement.querySelector(".dropdown-menu");
    menu.classList.toggle("hidden");
  });

  // Filter option click handlers
  document.getElementById("filterAll").addEventListener("click", (e) => {
    e.preventDefault();
    handleFilterChange("all");
    document.querySelector(".dropdown-menu").classList.add("hidden");
  });

  document.getElementById("filterDomain").addEventListener("click", (e) => {
    e.preventDefault();
    handleFilterChange("domain");
    document.querySelector(".dropdown-menu").classList.add("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    document.querySelector(".dropdown-menu").classList.add("hidden");
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
        case "annotate":
          enableAnnotationMode(id);
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

  // Event delegation for text note actions
  document.getElementById("savedTextsList").addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;

    if (action && id) {
      switch (action) {
        case "copyText":
          copyTextToClipboard(id);
          break;
        case "editText":
          editTextNote(id);
          break;
        case "deleteText":
          deleteTextNote(id);
          break;
      }
    }
  });

  // Annotation tool event listeners
  setupAnnotationListeners();

  // Listen for tab changes to reset panel
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const newTab = await chrome.tabs.get(activeInfo.tabId);
    if (newTab.url !== currentTab?.url) {
      resetPanelForNewTab(newTab);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tabId === currentTab?.id) {
      resetPanelForNewTab(tab);
    }
  });

  // Listen for new screenshots and storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.screenshots) {
      loadScreenshots();
    }
    if (changes.savedTexts) {
      loadSavedTexts();
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
    statusDiv.className =
      "p-3 rounded-md bg-green-50 text-green-800 border border-green-200 text-sm";
  } else if (type === "error") {
    statusDiv.className =
      "p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm";
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
    if (newWindow) {
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

// Legacy annotation functionality - now replaced with modal
function setupAnnotationListeners() {
  // These listeners are no longer needed as we use the modal
  console.log("Legacy annotation listeners - functionality moved to modal");
}

async function enableAnnotationMode(screenshotId) {
  selectedScreenshot = screenshots.find(
    (s) => s.id.toString() === screenshotId
  );
  if (!selectedScreenshot) return;

  try {
    // Send message to background script to open popup window
    await chrome.runtime.sendMessage({
      action: "openAnnotationPopup",
      screenshotId: screenshotId,
    });

    showStatus("Opening annotation window...", "success");
  } catch (error) {
    console.error("Error opening annotation popup:", error);
    showStatus("Error opening annotation window", "error");
  }
}

// Tab change detection and panel reset
function resetPanelForNewTab(newTab) {
  currentTab = newTab;

  // Update URL display
  document.getElementById("currentUrl").textContent = newTab.url;

  // Clear annotation mode
  annotationMode = null;
  selectedScreenshot = null;

  // Note: Annotation popups are separate windows and will close automatically when tab changes

  // Clear text input
  document.getElementById("textInput").value = "";

  // Reload screenshots and texts with current filter
  loadScreenshots();
  loadSavedTexts();

  showStatus("Panel reset for new tab/page", "success");
}

// Apply screenshot filter
function applyScreenshotFilter() {
  if (currentFilter === "all") {
    screenshots = [...allScreenshots];
  } else if (currentFilter === "domain" && currentTab) {
    const currentDomain = new URL(currentTab.url).hostname;
    screenshots = allScreenshots.filter((screenshot) => {
      try {
        const screenshotDomain = new URL(screenshot.url).hostname;
        return screenshotDomain === currentDomain;
      } catch (error) {
        return true; // Include if URL parsing fails
      }
    });
  } else {
    screenshots = [...allScreenshots];
  }
}

// Apply saved texts filter
function applySavedTextsFilter() {
  if (currentFilter === "all") {
    savedTexts = [...allSavedTexts];
  } else if (currentFilter === "domain" && currentTab) {
    const currentDomain = new URL(currentTab.url).hostname;
    savedTexts = allSavedTexts.filter((text) => {
      try {
        const textDomain = new URL(text.url).hostname;
        return textDomain === currentDomain;
      } catch (error) {
        return true;
      }
    });
  } else {
    savedTexts = [...allSavedTexts];
  }
}

// Handle filter change
function handleFilterChange(newFilter) {
  currentFilter = newFilter;

  // Update dropdown UI
  const dropdown = document.getElementById("filterDropdown");
  const filterText = document.getElementById("filterText");

  if (newFilter === "all") {
    filterText.textContent = "All Screenshots";
  } else if (newFilter === "domain") {
    filterText.textContent = "Current Domain";
  }

  // Apply filters and re-render
  applyScreenshotFilter();
  applySavedTextsFilter();
  renderScreenshots();
  renderSavedTexts();

  // Store filter preference
  chrome.storage.local.set({ currentFilter: newFilter });
}

// Load filter preference
async function loadFilterPreference() {
  const data = await chrome.storage.local.get(["currentFilter"]);
  currentFilter = data.currentFilter || "all";

  // Update UI
  const filterText = document.getElementById("filterText");
  if (currentFilter === "all") {
    filterText.textContent = "All Screenshots";
  } else if (currentFilter === "domain") {
    filterText.textContent = "Current Domain";
  }
}

// Text note management functions
async function saveTextNote() {
  const textInput = document.getElementById("textInput");
  const content = textInput.value.trim();

  if (!content) {
    showStatus("Please enter some text to save", "error");
    return;
  }

  try {
    const { savedTexts = [] } = await chrome.storage.local.get("savedTexts");
    const textNote = {
      id: Date.now(),
      content: content,
      url: currentTab.url,
      title: currentTab.title,
      timestamp: new Date().toISOString(),
    };

    savedTexts.unshift(textNote);

    // Keep only last 100 text notes
    if (savedTexts.length > 100) {
      savedTexts.splice(100);
    }

    await chrome.storage.local.set({ savedTexts });
    textInput.value = "";

    showStatus("Text note saved successfully!", "success");
  } catch (error) {
    console.error("Error saving text note:", error);
    showStatus("Error saving text note", "error");
  }
}

async function copyTextToClipboard(textId) {
  const textNote = savedTexts.find((t) => t.id.toString() === textId);
  if (textNote) {
    try {
      await navigator.clipboard.writeText(textNote.content);
      showStatus("Text copied to clipboard", "success");
    } catch (error) {
      showStatus("Error copying text", "error");
    }
  }
}

function editTextNote(textId) {
  const textNote = savedTexts.find((t) => t.id.toString() === textId);
  if (textNote) {
    document.getElementById("textInput").value = textNote.content;
    deleteTextNote(textId, false);
    showStatus("Text loaded for editing", "success");
  }
}

async function deleteTextNote(textId, showConfirm = true) {
  if (
    showConfirm &&
    !confirm("Are you sure you want to delete this text note?")
  ) {
    return;
  }

  try {
    const { savedTexts = [] } = await chrome.storage.local.get("savedTexts");
    const filtered = savedTexts.filter((t) => t.id.toString() !== textId);
    await chrome.storage.local.set({ savedTexts: filtered });

    if (showConfirm) {
      showStatus("Text note deleted", "success");
    }
  } catch (error) {
    console.error("Error deleting text note:", error);
    showStatus("Error deleting text note", "error");
  }
}
