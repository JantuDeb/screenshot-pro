// Content script for area selection and image cropping

let isSelecting = false;
let selectionOverlay = null;
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
  createSelectionOverlay();

  document.addEventListener("mousedown", onMouseDown, { capture: true });
  document.addEventListener("mousemove", onMouseMove, { capture: true });
  document.addEventListener("mouseup", onMouseUp, { capture: true });
  document.addEventListener("keydown", onKeyDown, { capture: true });
}

// Create selection overlay
function createSelectionOverlay() {
  // Remove existing overlay if any
  if (selectionOverlay) {
    selectionOverlay.remove();
  }

  // Inject CSS styles directly since CSS file may not be loaded
  injectSelectionStyles();

  selectionOverlay = document.createElement("div");
  selectionOverlay.id = "screenshot-selection-overlay";
  selectionOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    cursor: crosshair;
  `;

  // Create selection box
  const selectionBox = document.createElement("div");
  selectionBox.id = "selection-box";
  selectionBox.style.cssText = `
    position: absolute;
    border: 3px solid #3b82f6;
    background: rgba(59, 130, 246, 0.15);
    display: none;
    box-sizing: border-box;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8), 0 0 0 3px rgba(0, 0, 0, 0.3);
    outline: 2px dashed rgba(255, 255, 255, 0.7);
    outline-offset: 2px;
  `;

  // Create selection info
  const selectionInfo = document.createElement("div");
  selectionInfo.id = "selection-info";
  selectionInfo.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #374151;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `;

  const dimensionsSpan = document.createElement("span");
  dimensionsSpan.id = "selection-dimensions";
  dimensionsSpan.textContent = "Click and drag to select area";

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

  selectionOverlay.appendChild(selectionBox);
  selectionOverlay.appendChild(selectionInfo);

  document.body.appendChild(selectionOverlay);
}

// Inject CSS styles for selection
function injectSelectionStyles() {
  if (document.getElementById("screenshot-selection-styles")) return;

  const style = document.createElement("style");
  style.id = "screenshot-selection-styles";
  style.textContent = `
    #screenshot-selection-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.3) !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
    }
    
    #selection-box {
      position: absolute !important;
      border: 3px solid #3b82f6 !important;
      background: rgba(59, 130, 246, 0.15) !important;
      display: none !important;
      box-sizing: border-box !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8), 0 0 0 3px rgba(0, 0, 0, 0.3) !important;
      outline: 2px dashed rgba(255, 255, 255, 0.7) !important;
      outline-offset: 2px !important;
    }
    
    #selection-info {
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
    }
    
    #cancel-selection {
      background: #ef4444 !important;
      color: white !important;
      border: none !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-size: 11px !important;
      margin-left: 8px !important;
    }
    
    #cancel-selection:hover {
      background: #dc2626 !important;
    }
  `;
  document.head.appendChild(style);
}

// Mouse event handlers
function onMouseDown(e) {
  if (!isSelecting) return;

  e.preventDefault();
  e.stopPropagation();

  startX = e.clientX + window.scrollX;
  startY = e.clientY + window.scrollY;

  const selectionBox = document.getElementById("selection-box");
  if (selectionBox) {
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  }
}

function onMouseMove(e) {
  if (!isSelecting || startX === undefined) return;

  e.preventDefault();
  e.stopPropagation();

  endX = e.clientX + window.scrollX;
  endY = e.clientY + window.scrollY;

  const selectionBox = document.getElementById("selection-box");
  const info = document.getElementById("selection-dimensions");

  if (selectionBox && info) {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";

    info.textContent = `${width} x ${height}`;
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

  if (width > 10 && height > 10) {
    // Calculate viewport coordinates (without scroll)
    const viewportX = left - window.scrollX;
    const viewportY = top - window.scrollY;

    console.log("Selection area:", {
      viewport: { x: viewportX, y: viewportY, width, height },
      page: { x: left, y: top, width, height },
      scroll: { x: window.scrollX, y: window.scrollY },
      devicePixelRatio: window.devicePixelRatio,
    });

    // Send capture request to background script with viewport coordinates
    chrome.runtime.sendMessage({
      action: "captureArea",
      area: {
        x: viewportX,
        y: viewportY,
        width: width,
        height: height,
      },
    });
  }

  endSelection();
}

function onKeyDown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    endSelection();
  }
}

// End selection
function endSelection() {
  isSelecting = false;
  startX = startY = endX = endY = undefined;

  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }

  document.removeEventListener("mousedown", onMouseDown, { capture: true });
  document.removeEventListener("mousemove", onMouseMove, { capture: true });
  document.removeEventListener("mouseup", onMouseUp, { capture: true });
  document.removeEventListener("keydown", onKeyDown, { capture: true });
}

// Crop and save image
function cropAndSaveImage(dataUrl, area) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  img.onload = function () {
    try {
      // Calculate device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 2;

      console.log("Cropping image:", {
        area,
        originalImageSize: { width: img.width, height: img.height },
        devicePixelRatio: dpr,
        canvasSize: { width: area.width * dpr, height: area.height * dpr },
      });

      // Set canvas size based on the selection area
      canvas.width = area.width * dpr;
      canvas.height = area.height * dpr;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw the cropped portion
      ctx.drawImage(
        img,
        area.x * dpr, // Source x
        area.y * dpr, // Source y
        area.width * dpr, // Source width
        area.height * dpr, // Source height
        0, // Destination x
        0, // Destination y
        area.width * dpr, // Destination width
        area.height * dpr // Destination height
      );

      const croppedDataUrl = canvas.toDataURL("image/png");

      // Check if the cropped image is empty
      if (
        croppedDataUrl ===
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      ) {
        console.error("Cropped image is empty, area might be out of bounds");
        showNotification(
          "Screenshot area is empty. Please try selecting a different area."
        );
        return;
      }

      // Save cropped screenshot
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

      // Show notification
      showNotification(
        "Screenshot captured! Click the extension icon to view it."
      );

      // Note: Side panel should be opened by user action
    } catch (error) {
      console.error("Error cropping image:", error);
      showNotification("Error capturing screenshot. Please try again.");
    }
  };

  img.onerror = function () {
    console.error("Failed to load image for cropping");
    showNotification("Error loading screenshot. Please try again.");
  };

  img.src = dataUrl;
}

// Cancel selection button handler
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
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  // Add animation keyframes
  if (!document.getElementById("screenshot-notification-styles")) {
    const style = document.createElement("style");
    style.id = "screenshot-notification-styles";
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}
