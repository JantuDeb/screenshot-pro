// Settings page script

// Default settings
const defaultSettings = {
  autoSaveSelection: false,
  enableAnnotations: true,
  autoOpenSidebar: true,
  saveSelectedText: true,
  maxScreenshots: 50,
  filterByDomain: false,
  annotationColor: "#ef4444",
  annotationTextSize: 16,
};

// Load settings on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get("settings");
    const settings = { ...defaultSettings, ...stored.settings };

    // Apply settings to UI
    document.getElementById("autoSaveSelection").checked =
      settings.autoSaveSelection;
    document.getElementById("enableAnnotations").checked =
      settings.enableAnnotations;
    document.getElementById("autoOpenSidebar").checked =
      settings.autoOpenSidebar;
    document.getElementById("saveSelectedText").checked =
      settings.saveSelectedText;
    document.getElementById("maxScreenshots").value = settings.maxScreenshots;
    document.getElementById("filterByDomain").checked = settings.filterByDomain;
    document.getElementById("annotationColor").value = settings.annotationColor;
    document.getElementById("annotationTextSize").value =
      settings.annotationTextSize;
  } catch (error) {
    console.error("Error loading settings:", error);
    showStatus("Error loading settings", "error");
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      autoSaveSelection: document.getElementById("autoSaveSelection").checked,
      enableAnnotations: document.getElementById("enableAnnotations").checked,
      autoOpenSidebar: document.getElementById("autoOpenSidebar").checked,
      saveSelectedText: document.getElementById("saveSelectedText").checked,
      maxScreenshots: parseInt(document.getElementById("maxScreenshots").value),
      filterByDomain: document.getElementById("filterByDomain").checked,
      annotationColor: document.getElementById("annotationColor").value,
      annotationTextSize: parseInt(
        document.getElementById("annotationTextSize").value
      ),
    };

    await chrome.storage.local.set({ settings });

    // Also update max screenshots immediately
    await enforceMaxScreenshots(settings.maxScreenshots);

    showStatus("Settings saved successfully!", "success");
  } catch (error) {
    console.error("Error saving settings:", error);
    showStatus("Error saving settings", "error");
  }
}

// Reset settings to defaults
async function resetSettings() {
  if (confirm("Are you sure you want to reset all settings to defaults?")) {
    try {
      await chrome.storage.local.set({ settings: defaultSettings });
      await loadSettings();
      showStatus("Settings reset to defaults", "success");
    } catch (error) {
      console.error("Error resetting settings:", error);
      showStatus("Error resetting settings", "error");
    }
  }
}

// Enforce max screenshots limit
async function enforceMaxScreenshots(maxCount) {
  try {
    const { screenshots = [] } = await chrome.storage.local.get("screenshots");
    if (screenshots.length > maxCount) {
      const trimmed = screenshots.slice(0, maxCount);
      await chrome.storage.local.set({ screenshots: trimmed });
    }
  } catch (error) {
    console.error("Error enforcing max screenshots:", error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document
    .getElementById("saveSettings")
    .addEventListener("click", saveSettings);
  document
    .getElementById("resetSettings")
    .addEventListener("click", resetSettings);

  // Auto-save on change
  const inputs = document.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      // Auto-save with slight delay
      clearTimeout(window.autoSaveTimeout);
      window.autoSaveTimeout = setTimeout(saveSettings, 1000);
    });
  });
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById("statusMessage");
  statusDiv.textContent = message;

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
  }, 3000);
}

// Export settings utilities for other scripts
window.settingsUtils = {
  getSettings: async () => {
    const stored = await chrome.storage.local.get("settings");
    return { ...defaultSettings, ...stored.settings };
  },

  getSetting: async (key) => {
    const settings = await window.settingsUtils.getSettings();
    return settings[key];
  },
};
