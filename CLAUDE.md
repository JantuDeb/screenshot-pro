# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "Screenshot Capture Pro" that allows users to capture screenshots with area selection, text input, and API submission capabilities. The extension provides multiple capture modes and a sidebar for managing screenshots.

## Project Structure

```
chrome-extension/
├── manifest.json           # Chrome extension manifest
├── package.json           # Node.js dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── public/               # HTML files
│   ├── popup.html        # Extension popup interface
│   └── sidebar.html      # Side panel interface
├── scripts/              # JavaScript files
│   ├── background.js     # Background service worker
│   ├── content.js        # Content script for area selection
│   ├── popup.js          # Popup functionality
│   └── sidebar.js        # Sidebar functionality
├── styles/               # CSS and styling
│   ├── src/input.css     # Tailwind CSS source
│   └── dist/output.css   # Built CSS (generated)
└── assets/               # Static assets (icons, images)
```

## Architecture

### Core Components

**Background Script (`scripts/background.js`)**
- Service worker that handles extension lifecycle
- Manages context menus for text selection
- Handles keyboard shortcuts (Ctrl+Shift+S for area capture, Ctrl+Shift+T for tab capture)
- Coordinates screenshot capture and storage
- Manages side panel opening/closing

**Content Script (`scripts/content.js`)**
- Injected into all web pages
- Handles area selection UI with mouse interactions
- Provides visual overlay for screenshot selection
- Performs image cropping using HTML5 Canvas
- Manages high-DPI display support

**Popup (`public/popup.html` + `scripts/popup.js`)**
- Extension icon popup interface
- Provides buttons for capture modes and sidebar access
- Simple UI for quick actions

**Sidebar (`public/sidebar.html` + `scripts/sidebar.js`)**
- Side panel for screenshot management
- Displays recent screenshots (up to 50)
- Provides text input for annotations
- Handles API submission functionality
- Manages screenshot actions (view, download, copy, delete)

### Data Flow

1. **Screenshot Capture**: User initiates capture via popup, keyboard shortcut, or sidebar
2. **Processing**: Background script captures tab, content script crops if needed
3. **Storage**: Screenshots stored in Chrome local storage with metadata
4. **Management**: Sidebar displays screenshots and allows management actions
5. **API Integration**: Screenshots can be submitted to external APIs with text annotations

### Storage Schema

Screenshots are stored in Chrome local storage with this structure:
```javascript
{
  id: timestamp,
  url: string,
  title: string,
  timestamp: ISO string,
  dataUrl: base64 data URL,
  type: "area-selection" | "full-tab",
  area?: { x, y, width, height }
}
```

## Key Features

- **Area Selection**: Interactive mouse-based selection with visual feedback
- **Full Tab Capture**: Capture entire visible tab
- **Text Integration**: Context menu for adding selected text to screenshots
- **API Submission**: Configurable endpoint for submitting screenshots with metadata
- **Screenshot Management**: View, download, copy to clipboard, and delete screenshots
- **Keyboard Shortcuts**: Ctrl+Shift+S (area), Ctrl+Shift+T (tab)
- **High-DPI Support**: Handles device pixel ratio for crisp screenshots

## Development Notes

- Uses Tailwind CSS for styling with custom CSS variables
- Build process: `npm run build` or `npm run build-css` (watch mode)
- Uses Chrome Extensions Manifest V3
- Requires permissions: activeTab, storage, contextMenus, sidePanel, tabs
- Host permissions: `<all_urls>`
- Storage limited to 50 recent screenshots (automatically pruned)
- All UI components use Tailwind classes with semantic color variables

## Build Commands

- `npm install` - Install dependencies
- `npm run build` - Build Tailwind CSS once
- `npm run build-css` - Build Tailwind CSS in watch mode
- `npm run dev` - Alias for build-css (watch mode)
- Built CSS is output to `styles/dist/output.css`

## Styling System

Uses Tailwind CSS with custom CSS variables for theming:
- Light/dark mode support via CSS variables
- Semantic color naming (background, foreground, primary, secondary, etc.)
- Custom selection overlay styles for screenshot area selection
- Responsive design principles