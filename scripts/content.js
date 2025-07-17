// Content script for area selection and image cropping

let isSelecting = false;
let selectionBox = null;
let eventCaptureLayer = null;
let selectionInfo = null;
let startX, startY, endX, endY;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  try {
    if (request.action === "startAreaCapture") {
      startAreaSelection();
      sendResponse({ success: true });
    } else if (request.action === "cropImage") {
      cropAndSaveImage(request.dataUrl, request.area);
      sendResponse({ success: true });
    } else if (request.action === "showNotification") {
      showNotification(request.message);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("Error in content script:", error);
    sendResponse({ success: false, error: error.message });
  }

  // Return true to indicate we will send a response asynchronously
  return true;
});

// Start area selection
function startAreaSelection() {
  if (isSelecting) return;

  isSelecting = true;
  document.body.style.userSelect = "none"; // Prevent text selection while dragging
  createSelectionUI();

  document.addEventListener("mousedown", onMouseDown, { capture: true });
  document.addEventListener("mousemove", onMouseMove, { capture: true });
  document.addEventListener("mouseup", onMouseUp, { capture: true });
  document.addEventListener("keydown", onKeyDown, { capture: true });
}

// Create all UI elements for selection
function createSelectionUI() {
  // This layer captures mouse events across the entire screen
  eventCaptureLayer = document.createElement("div");
  eventCaptureLayer.id = "screenshot-event-capture-layer";
  eventCaptureLayer.style.cssText = `
    position: fixed !important;
    top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 2147483645 !important;
    cursor: crosshair !important;
  `;
  document.body.appendChild(eventCaptureLayer);

  // This is the visual selection box. The large box-shadow creates the overlay effect.
  selectionBox = document.createElement("div");
  selectionBox.id = "screenshot-selection-box";
  selectionBox.style.cssText = `
    position: absolute !important;
    border: 1px dashed #fff !important;
    background: transparent !important;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
    z-index: 2147483646 !important;
    pointer-events: none !important;
    display: none;
  `;
  document.body.appendChild(selectionBox);

  // This box displays dimensions and the cancel button
  selectionInfo = document.createElement("div");
  selectionInfo.id = "selection-info";
  selectionInfo.style.cssText = `
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    background: white !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    font-size: 12px !important;
    color: #374151 !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
    z-index: 2147483647 !important;
  `;

  const dimensionsSpan = document.createElement("span");
  dimensionsSpan.id = "selection-dimensions";
  dimensionsSpan.textContent = "Click and drag to select an area";

  const cancelButton = document.createElement("button");
  cancelButton.id = "cancel-selection";
  cancelButton.textContent = "Cancel (ESC)";
  cancelButton.style.cssText = `
    background: #ef4444;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-left: 8px;
  `;

  selectionInfo.appendChild(dimensionsSpan);
  selectionInfo.appendChild(cancelButton);
  document.body.appendChild(selectionInfo);
}

// Mouse event handlers
function onMouseDown(e) {
  if (!isSelecting) return;

  e.preventDefault();
  e.stopPropagation();

  startX = e.clientX;
  startY = e.clientY;

  selectionBox.style.left = startX + "px";
  selectionBox.style.top = startY + "px";
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
  selectionBox.style.display = "block";
}

function onMouseMove(e) {
  if (!isSelecting || startX === undefined) return;

  e.preventDefault();
  e.stopPropagation();

  endX = e.clientX;
  endY = e.clientY;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  selectionBox.style.left = left + "px";
  selectionBox.style.top = top + "px";
  selectionBox.style.width = width + "px";
  selectionBox.style.height = height + "px";

  const infoText = document.getElementById("selection-dimensions");
  if (infoText) {
    infoText.textContent = `${width}px × ${height}px`;
  }
}

function onMouseUp(e) {
  if (!isSelecting || startX === undefined) return;

  e.preventDefault();
  e.stopPropagation();

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // IMPORTANT: Clean up the UI *before* taking action
  endSelection();

  if (width > 10 && height > 10) {
    const area = {
      x: left,
      y: top,
      width: width,
      height: height,
    };
    checkAutoSaveAndCapture(area);
  }
}

function onKeyDown(e) {
  if (isSelecting && e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    endSelection();
  }
}

// End selection and remove all UI elements
function endSelection() {
  if (!isSelecting) return;
  isSelecting = false;

  document.body.style.userSelect = "auto";

  if (selectionBox) selectionBox.remove();
  if (eventCaptureLayer) eventCaptureLayer.remove();
  if (selectionInfo) selectionInfo.remove();

  selectionBox = eventCaptureLayer = selectionInfo = null;
  startX = startY = endX = endY = undefined;

  document.removeEventListener("mousedown", onMouseDown, { capture: true });
  document.removeEventListener("mousemove", onMouseMove, { capture: true });
  document.removeEventListener("mouseup", onMouseUp, { capture: true });
  document.removeEventListener("keydown", onKeyDown, { capture: true });
}

// Check auto-save settings and then capture or show confirmation
async function checkAutoSaveAndCapture(area) {
  try {
    const { settings } = await chrome.storage.local.get("settings");
    const autoSaveEnabled = settings && settings.autoSaveSelection;

    if (autoSaveEnabled) {
      chrome.runtime.sendMessage({ action: "captureArea", area });
    } else {
      showCaptureConfirmation(area);
    }
  } catch (error) {
    console.error("Error checking auto-save settings:", error);
    showCaptureConfirmation(area); // Fallback to manual confirmation
  }
}

// Show capture confirmation dialog
function showCaptureConfirmation(area) {
  const confirmationDialog = document.createElement("div");
  confirmationDialog.id = "capture-confirmation";
  confirmationDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    min-width: 300px;
    text-align: center;
  `;

  confirmationDialog.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">Capture Screenshot?</h3>
    <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
      Area: ${area.width} × ${area.height} pixels
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="confirm-capture" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">Capture</button>
      <button id="cancel-capture" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
    </div>
  `;

  document.body.appendChild(confirmationDialog);

  document.getElementById("confirm-capture").onclick = () => {
    chrome.runtime.sendMessage({ action: "captureArea", area });
    confirmationDialog.remove();
  };

  document.getElementById("cancel-capture").onclick = () => {
    confirmationDialog.remove();
  };
}

// Crop and save image
function cropAndSaveImage(dataUrl, area) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  img.onload = function () {
    try {
      const dpr = window.devicePixelRatio || 1;

      canvas.width = area.width * dpr;
      canvas.height = area.height * dpr;

      ctx.drawImage(
        img,
        area.x * dpr,
        area.y * dpr,
        area.width * dpr,
        area.height * dpr,
        0,
        0,
        area.width * dpr,
        area.height * dpr
      );

      const croppedDataUrl = canvas.toDataURL("image/png");

      if (croppedDataUrl.length < 100) {
        // Simple check for empty image
        throw new Error("Cropped image is empty or too small.");
      }

      const screenshotData = {
        id: Date.now(),
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        dataUrl: croppedDataUrl,
        type: "area-selection",
        area: area,
      };

      chrome.runtime.sendMessage({
        action: "saveScreenshot",
        data: screenshotData,
      });

      showNotification(
        "Screenshot captured! Click the extension icon to view it."
      );
    } catch (error) {
      console.error("Error cropping image:", error);
      showNotification(
        "Error capturing screenshot. The area might be invalid."
      );
    }
  };

  img.onerror = function () {
    console.error("Failed to load image for cropping.");
    showNotification("Error loading screenshot data. Please try again.");
  };

  img.src = dataUrl;
}

// Handle clicking the "Cancel" button in the info box
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "cancel-selection") {
    endSelection();
  }
});

// Show notification to user
function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: translateX(100%);
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 10);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300); // Wait for transition to finish
  }, 3000);
}
