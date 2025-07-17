// Sidebar script for Chrome extension

let currentTab = null;
let screenshots = [];
let annotationMode = null;
let selectedScreenshot = null;
let savedTexts = [];

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
  const data = await chrome.storage.local.get(["screenshots", "settings"]);
  let allScreenshots = data.screenshots || [];

  // Apply domain filtering if enabled
  if (data.settings && data.settings.filterByDomain && currentTab) {
    const currentDomain = new URL(currentTab.url).hostname;
    screenshots = allScreenshots.filter((screenshot) => {
      try {
        const screenshotDomain = new URL(screenshot.url).hostname;
        return screenshotDomain === currentDomain;
      } catch (error) {
        // If URL parsing fails, include the screenshot
        return true;
      }
    });
  } else {
    screenshots = allScreenshots;
  }

  renderScreenshots();
}

async function loadSavedTexts() {
  const data = await chrome.storage.local.get(["savedTexts", "settings"]);
  let allTexts = data.savedTexts || [];

  // Apply domain filtering if enabled
  if (data.settings && data.settings.filterByDomain && currentTab) {
    const currentDomain = new URL(currentTab.url).hostname;
    savedTexts = allTexts.filter((text) => {
      try {
        const textDomain = new URL(text.url).hostname;
        return textDomain === currentDomain;
      } catch (error) {
        return true;
      }
    });
  } else {
    savedTexts = allTexts;
  }

  renderSavedTexts();
}

function renderScreenshots() {
  const container = document.getElementById("screenshotsList");

  if (screenshots.length === 0) {
    // Check if filtering is enabled to show appropriate message
    chrome.storage.local.get("settings").then((data) => {
      const isFiltering = data.settings && data.settings.filterByDomain;
      const message = isFiltering
        ? "No screenshots for this domain yet. Capture your first screenshot or disable domain filtering in settings!"
        : "No screenshots yet. Capture your first screenshot!";
      container.innerHTML = `<div class="text-center py-10 text-muted-foreground">${message}</div>`;
    });
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
    chrome.storage.local.get("settings").then((data) => {
      const isFiltering = data.settings && data.settings.filterByDomain;
      const message = isFiltering
        ? "No saved texts for this domain yet. Save your first text note!"
        : "No saved texts yet. Save your first text note!";
      container.innerHTML = `<div class="text-center py-6 text-muted-foreground text-xs">${message}</div>`;
    });
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
          }" class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700">Edit</button>
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

// Annotation functionality
function setupAnnotationListeners() {
  const annotateText = document.getElementById("annotateText");
  const annotateDraw = document.getElementById("annotateDraw");
  const annotateHighlight = document.getElementById("annotateHighlight");
  const clearAnnotations = document.getElementById("clearAnnotations");

  annotateText.addEventListener("click", () => setAnnotationMode("text"));
  annotateDraw.addEventListener("click", () => setAnnotationMode("draw"));
  annotateHighlight.addEventListener("click", () =>
    setAnnotationMode("highlight")
  );
  clearAnnotations.addEventListener("click", clearAllAnnotations);
}

function enableAnnotationMode(screenshotId) {
  selectedScreenshot = screenshots.find(
    (s) => s.id.toString() === screenshotId
  );
  if (!selectedScreenshot) return;

  // Show annotation tools
  document.getElementById("annotationTools").classList.remove("hidden");

  // Load settings for annotation tools
  loadAnnotationSettings();

  // Create annotation canvas
  createAnnotationCanvas();

  showStatus(
    "Annotation mode enabled. Select a tool and click on the image.",
    "success"
  );
}

async function loadAnnotationSettings() {
  try {
    const { settings } = await chrome.storage.local.get("settings");
    if (settings) {
      document.getElementById("annotationColorPicker").value =
        settings.annotationColor || "#ef4444";
      document.getElementById("annotationSizePicker").value =
        settings.annotationTextSize || 16;
    }
  } catch (error) {
    console.error("Error loading annotation settings:", error);
  }
}

function setAnnotationMode(mode) {
  annotationMode = mode;

  // Update button states
  document.querySelectorAll("#annotationTools button").forEach((btn) => {
    btn.classList.remove("ring-2", "ring-white");
  });

  const activeButton = document.getElementById(
    `annotate${mode.charAt(0).toUpperCase() + mode.slice(1)}`
  );
  if (activeButton) {
    activeButton.classList.add("ring-2", "ring-white");
  }

  showStatus(
    `${
      mode.charAt(0).toUpperCase() + mode.slice(1)
    } mode active. Click on image to annotate.`,
    "success"
  );
}

function createAnnotationCanvas() {
  if (!selectedScreenshot) return;

  // Find the screenshot image element
  const screenshotImg = document.querySelector(
    `img[data-id="${selectedScreenshot.id}"]`
  );
  if (!screenshotImg) return;

  // Add click listener for annotations
  screenshotImg.style.cursor = "crosshair";
  screenshotImg.addEventListener("click", handleAnnotationClick);
}

function handleAnnotationClick(event) {
  if (!annotationMode || !selectedScreenshot) return;

  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Calculate relative position
  const relativeX = x / rect.width;
  const relativeY = y / rect.height;

  if (annotationMode === "text") {
    addTextAnnotation(relativeX, relativeY, event.target);
  } else if (annotationMode === "highlight") {
    addHighlightAnnotation(relativeX, relativeY, event.target);
  }
  // Draw mode would require more complex canvas implementation
}

function addTextAnnotation(x, y, imageElement) {
  const text = prompt("Enter annotation text:");
  if (!text) return;

  const color = document.getElementById("annotationColorPicker").value;
  const size = document.getElementById("annotationSizePicker").value;

  // Create annotation element
  const annotation = document.createElement("div");
  annotation.className =
    "absolute bg-white border border-gray-300 rounded px-2 py-1 text-xs shadow-lg z-10";
  annotation.style.cssText = `
    position: absolute;
    left: ${x * 100}%;
    top: ${y * 100}%;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: ${size}px;
    color: ${color};
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 10;
    transform: translate(-50%, -100%);
    max-width: 200px;
    word-wrap: break-word;
  `;
  annotation.textContent = text;

  // Position relative to image container
  const container = imageElement.parentElement;
  container.style.position = "relative";
  container.appendChild(annotation);

  // Save annotation data
  saveAnnotation({
    type: "text",
    x: x,
    y: y,
    text: text,
    color: color,
    size: size,
    screenshotId: selectedScreenshot.id,
  });

  showStatus("Text annotation added", "success");
}

function addHighlightAnnotation(x, y, imageElement) {
  const color = document.getElementById("annotationColorPicker").value;

  // Create highlight overlay
  const highlight = document.createElement("div");
  highlight.style.cssText = `
    position: absolute;
    left: ${x * 100 - 2}%;
    top: ${y * 100 - 2}%;
    width: 4%;
    height: 4%;
    background: ${color};
    opacity: 0.6;
    border-radius: 50%;
    z-index: 9;
    pointer-events: none;
  `;

  // Position relative to image container
  const container = imageElement.parentElement;
  container.style.position = "relative";
  container.appendChild(highlight);

  // Save annotation data
  saveAnnotation({
    type: "highlight",
    x: x,
    y: y,
    color: color,
    screenshotId: selectedScreenshot.id,
  });

  showStatus("Highlight annotation added", "success");
}

async function saveAnnotation(annotationData) {
  try {
    const { annotations = [] } = await chrome.storage.local.get("annotations");
    annotations.push({
      ...annotationData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
    await chrome.storage.local.set({ annotations });
  } catch (error) {
    console.error("Error saving annotation:", error);
  }
}

function clearAllAnnotations() {
  if (!selectedScreenshot) return;

  if (confirm("Clear all annotations for this screenshot?")) {
    // Remove annotation elements from DOM
    const container = document.querySelector(
      `img[data-id="${selectedScreenshot.id}"]`
    )?.parentElement;
    if (container) {
      container
        .querySelectorAll('div[style*="position: absolute"]')
        .forEach((el) => el.remove());
    }

    // Remove from storage
    removeAnnotationsFromStorage(selectedScreenshot.id);

    showStatus("All annotations cleared", "success");
  }
}

async function removeAnnotationsFromStorage(screenshotId) {
  try {
    const { annotations = [] } = await chrome.storage.local.get("annotations");
    const filtered = annotations.filter(
      (annotation) => annotation.screenshotId !== screenshotId
    );
    await chrome.storage.local.set({ annotations: filtered });
  } catch (error) {
    console.error("Error removing annotations:", error);
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
  document.getElementById("annotationTools").classList.add("hidden");

  // Reset annotation button states
  document.querySelectorAll("#annotationTools button").forEach((btn) => {
    btn.classList.remove("ring-2", "ring-white");
  });

  // Clear text input
  document.getElementById("textInput").value = "";

  // Reload screenshots and texts with domain filtering if enabled
  loadScreenshots();
  loadSavedTexts();

  showStatus("Panel reset for new tab/page", "success");
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
