// Annotation Popup Script - Handles annotation functionality in popup window

class AnnotationPopup {
  constructor() {
    this.rough = null;
    this.currentTool = "pen";
    this.currentColor = "#ef4444";
    this.currentSize = 3;
    this.annotations = [];
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentPath = [];
    this.screenshot = null;
    this.canvas = null;
    this.ctx = null;
    this.img = null;
  }

  // Initialize the annotation popup
  async init() {
    try {
      console.log("Initializing annotation popup...");

      // Get screenshot data from URL parameters or storage
      await this.loadScreenshotData();

      // Setup UI
      this.setupUI();

      // Initialize Rough.js
      this.rough = rough;

      // Setup canvas
      this.setupCanvas();

      // Setup event listeners
      this.setupEventListeners();

      // Hide loading, show annotation container
      document.getElementById("loading").classList.add("hidden");
      document
        .getElementById("annotation-container")
        .classList.remove("hidden");

      console.log("Annotation popup initialized successfully");
    } catch (error) {
      console.error("Error initializing annotation popup:", error);
      this.showError("Failed to initialize annotation interface");
    }
  }

  // Load screenshot data
  async loadScreenshotData() {
    try {
      // Get screenshot data from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const screenshotId = urlParams.get("id");

      if (!screenshotId) {
        throw new Error("No screenshot ID provided");
      }

      // Get screenshot from storage
      const result = await chrome.storage.local.get(["screenshots"]);
      const screenshots = result.screenshots || [];

      this.screenshot = screenshots.find(
        (s) => s.id.toString() === screenshotId
      );

      if (!this.screenshot) {
        throw new Error("Screenshot not found");
      }

      console.log("Screenshot loaded:", this.screenshot);
    } catch (error) {
      console.error("Error loading screenshot data:", error);
      throw error;
    }
  }

  // Setup UI elements
  setupUI() {
    this.img = document.getElementById("target-image");
    this.canvas = document.getElementById("annotation-canvas");
    this.ctx = this.canvas.getContext("2d");

    // Set image source
    this.img.src = this.screenshot.dataUrl;

    // Update window title
    document.title = `Annotate - ${this.screenshot.title}`;
  }

  // Setup canvas
  setupCanvas() {
    this.img.onload = () => {
      // Set canvas size to match image
      this.canvas.width = this.img.naturalWidth;
      this.canvas.height = this.img.naturalHeight;
      this.canvas.style.width = this.img.offsetWidth + "px";
      this.canvas.style.height = this.img.offsetHeight + "px";

      // Initialize Rough.js canvas
      this.rough = rough.canvas(this.canvas);

      console.log("Canvas setup complete");
    };

    // If image is already loaded
    if (this.img.complete) {
      this.img.onload();
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Tool buttons
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectTool(btn.dataset.tool);
      });
    });

    // Color picker
    document.getElementById("color-picker").addEventListener("change", (e) => {
      this.currentColor = e.target.value;
    });

    // Size slider
    document.getElementById("size-slider").addEventListener("input", (e) => {
      this.currentSize = parseInt(e.target.value);
      document.getElementById("size-display").textContent =
        e.target.value + "px";
    });

    // Action buttons
    document.getElementById("undo-btn").addEventListener("click", () => {
      this.undoLastAnnotation();
    });

    document.getElementById("clear-btn").addEventListener("click", () => {
      this.clearAllAnnotations();
    });

    // Footer buttons
    document.getElementById("save-btn").addEventListener("click", () => {
      this.saveAnnotations();
    });

    document.getElementById("cancel-btn").addEventListener("click", () => {
      this.closePopup();
    });

    // Canvas events
    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this.canvas.addEventListener("mousemove", this.draw.bind(this));
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("mouseout", this.stopDrawing.bind(this));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closePopup();
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.undoLastAnnotation();
      }
    });

    // Window close confirmation
    window.addEventListener("beforeunload", (e) => {
      if (this.annotations.length > 0) {
        e.preventDefault();
        return ""; // Modern browsers use this instead of returnValue
      }
    });
  }

  // Select tool
  selectTool(tool) {
    this.currentTool = tool;

    // Update UI
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.querySelector(`[data-tool="${tool}"]`).classList.add("active");

    // Update cursor
    this.canvas.style.cursor = tool === "text" ? "text" : "crosshair";

    console.log("Selected tool:", tool);
  }

  // Start drawing
  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.startX =
      (e.clientX - rect.left) * (this.canvas.width / this.canvas.offsetWidth);
    this.startY =
      (e.clientY - rect.top) * (this.canvas.height / this.canvas.offsetHeight);

    if (this.currentTool === "pen") {
      this.currentPath = [{ x: this.startX, y: this.startY }];
    } else if (this.currentTool === "text") {
      this.addTextAnnotation(this.startX, this.startY);
      this.isDrawing = false;
    }
  }

  // Continue drawing
  draw(e) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentX =
      (e.clientX - rect.left) * (this.canvas.width / this.canvas.offsetWidth);
    const currentY =
      (e.clientY - rect.top) * (this.canvas.height / this.canvas.offsetHeight);

    if (this.currentTool === "pen") {
      this.currentPath.push({ x: currentX, y: currentY });
      // Only redraw the current path segment to prevent flickering
      this.drawCurrentPathSegment(currentX, currentY);
    } else {
      // For shapes, show preview - this will cause some flickering but it's necessary for preview
      this.redrawCanvas();
      this.drawShapePreview(this.startX, this.startY, currentX, currentY);
    }
  }

  // Stop drawing
  stopDrawing(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const rect = this.canvas.getBoundingClientRect();
    const endX =
      (e.clientX - rect.left) * (this.canvas.width / this.canvas.offsetWidth);
    const endY =
      (e.clientY - rect.top) * (this.canvas.height / this.canvas.offsetHeight);

    if (this.currentTool === "pen" && this.currentPath.length > 1) {
      this.annotations.push({
        type: "pen",
        path: [...this.currentPath],
        color: this.currentColor,
        size: this.currentSize,
      });
      this.currentPath = [];
      // For pen tool, no need to redraw everything, the path is already drawn
    } else if (this.currentTool !== "pen" && this.currentTool !== "text") {
      this.annotations.push({
        type: this.currentTool,
        startX: this.startX,
        startY: this.startY,
        endX: endX,
        endY: endY,
        color: this.currentColor,
        size: this.currentSize,
      });
      // For shapes, we need to redraw to replace the preview with the final shape
      this.redrawCanvas();
    }
  }

  // Draw current path while drawing - draws the complete path
  drawCurrentPath() {
    if (this.currentPath.length < 2) return;

    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
    for (let i = 1; i < this.currentPath.length; i++) {
      this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
    }
    this.ctx.stroke();
  }

  // Draw only the current path segment to prevent flickering
  drawCurrentPathSegment(currentX, currentY) {
    if (this.currentPath.length < 2) return;

    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw line from previous point to current point
    const prevPoint = this.currentPath[this.currentPath.length - 2];
    this.ctx.beginPath();
    this.ctx.moveTo(prevPoint.x, prevPoint.y);
    this.ctx.lineTo(currentX, currentY);
    this.ctx.stroke();
  }

  // Draw shape preview with optimized approach
  drawShapePreview(startX, startY, currentX, currentY) {
    // Use a more efficient approach to minimize flickering
    this.ctx.save();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalAlpha = 0.8; // Slightly transparent preview

    this.ctx.beginPath();

    if (this.currentTool === "rectangle") {
      this.ctx.rect(startX, startY, currentX - startX, currentY - startY);
    } else if (this.currentTool === "circle") {
      const radius = Math.sqrt(
        Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
      );
      this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    } else if (this.currentTool === "arrow") {
      this.drawArrow(startX, startY, currentX, currentY);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  // Draw arrow
  drawArrow(startX, startY, endX, endY) {
    const headLength = 20;
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);

    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  // Add text annotation
  addTextAnnotation(x, y) {
    const text = prompt("Enter text:");
    if (text) {
      this.annotations.push({
        type: "text",
        x: x,
        y: y,
        text: text,
        color: this.currentColor,
        size: this.currentSize * 6,
      });
      this.redrawCanvas();
    }
  }

  // Redraw all annotations
  redrawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.annotations.forEach((annotation) => {
      if (annotation.type === "pen") {
        this.drawRoughPath(annotation);
      } else if (annotation.type === "rectangle") {
        this.drawRoughRectangle(annotation);
      } else if (annotation.type === "circle") {
        this.drawRoughCircle(annotation);
      } else if (annotation.type === "arrow") {
        this.drawRoughArrow(annotation);
      } else if (annotation.type === "text") {
        this.drawText(annotation);
      }
    });
  }

  // Draw rough path
  drawRoughPath(annotation) {
    if (annotation.path.length < 2) return;

    this.ctx.strokeStyle = annotation.color;
    this.ctx.lineWidth = annotation.size;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(annotation.path[0].x, annotation.path[0].y);
    for (let i = 1; i < annotation.path.length; i++) {
      this.ctx.lineTo(annotation.path[i].x, annotation.path[i].y);
    }
    this.ctx.stroke();
  }

  // Draw rough rectangle
  drawRoughRectangle(annotation) {
    this.rough.rectangle(
      annotation.startX,
      annotation.startY,
      annotation.endX - annotation.startX,
      annotation.endY - annotation.startY,
      {
        stroke: annotation.color,
        strokeWidth: annotation.size,
        roughness: 1,
        bowing: 1,
      }
    );
  }

  // Draw rough circle
  drawRoughCircle(annotation) {
    const radius = Math.sqrt(
      Math.pow(annotation.endX - annotation.startX, 2) +
        Math.pow(annotation.endY - annotation.startY, 2)
    );

    this.rough.circle(annotation.startX, annotation.startY, radius * 2, {
      stroke: annotation.color,
      strokeWidth: annotation.size,
      roughness: 1,
      bowing: 1,
    });
  }

  // Draw rough arrow
  drawRoughArrow(annotation) {
    this.ctx.strokeStyle = annotation.color;
    this.ctx.lineWidth = annotation.size;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.drawArrow(
      annotation.startX,
      annotation.startY,
      annotation.endX,
      annotation.endY
    );
  }

  // Draw text
  drawText(annotation) {
    this.ctx.font = `${annotation.size}px Arial`;
    this.ctx.fillStyle = annotation.color;
    this.ctx.fillText(annotation.text, annotation.x, annotation.y);
  }

  // Undo last annotation
  undoLastAnnotation() {
    if (this.annotations.length > 0) {
      this.annotations.pop();
      this.redrawCanvas();
    }
  }

  // Clear all annotations
  clearAllAnnotations() {
    if (confirm("Clear all annotations?")) {
      this.annotations = [];
      this.redrawCanvas();
    }
  }

  // Save annotations
  async saveAnnotations() {
    try {
      console.log("Saving annotations...");

      // Create merged canvas
      const mergedCanvas = document.createElement("canvas");
      const mergedCtx = mergedCanvas.getContext("2d");

      // Set canvas size
      mergedCanvas.width = this.img.naturalWidth;
      mergedCanvas.height = this.img.naturalHeight;

      // Draw the base image
      mergedCtx.drawImage(this.img, 0, 0);

      // Draw the annotations on top
      mergedCtx.drawImage(this.canvas, 0, 0);

      // Convert to data URL
      const annotatedDataUrl = mergedCanvas.toDataURL("image/png");

      // Send message to background script to save
      await chrome.runtime.sendMessage({
        action: "saveAnnotatedScreenshot",
        screenshotId: this.screenshot.id,
        annotatedDataUrl: annotatedDataUrl,
      });

      console.log("Annotations saved successfully");

      // Close popup
      this.closePopup();
    } catch (error) {
      console.error("Error saving annotations:", error);
      this.showError("Failed to save annotations");
    }
  }

  // Close popup
  closePopup() {
    console.log("Closing annotation popup...");
    window.close();
  }

  // Show error message
  showError(message) {
    document.getElementById("loading").innerHTML = `
      <div style="color: #ef4444; text-align: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 10px;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <div>${message}</div>
      </div>
    `;
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const popup = new AnnotationPopup();
  popup.init();
});
