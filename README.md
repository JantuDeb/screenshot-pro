# Screenshot Capture Pro

A Chrome extension for capturing screenshots with area selection, text input, and API submission capabilities.

## Project Structure

```
chrome-extension/
├── manifest.json           # Chrome extension manifest
├── package.json           # Node.js dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── .gitignore            # Git ignore rules
├── CLAUDE.md             # Claude Code guidance
├── README.md             # This file
├── public/               # HTML files
│   ├── popup.html        # Extension popup interface
│   └── sidebar.html      # Side panel interface
├── scripts/              # JavaScript files
│   ├── background.js     # Background service worker
│   ├── content.js        # Content script for area selection
│   ├── popup.js          # Popup functionality
│   └── sidebar.js        # Sidebar functionality
├── styles/               # CSS and styling
│   ├── src/
│   │   └── input.css     # Tailwind CSS source
│   └── dist/
│       └── output.css    # Built CSS (generated)
└── assets/               # Static assets (icons, images)
```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build CSS:
   ```bash
   npm run build
   ```

3. For development with CSS watching:
   ```bash
   npm run dev
   ```

## Loading the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. The extension will appear in your browser toolbar

## Features

- **Area Selection**: Click and drag to select specific areas of web pages
- **Full Tab Capture**: Capture entire browser tabs
- **Text Integration**: Add selected text to screenshots via context menu
- **API Submission**: Submit screenshots and text to configurable API endpoints
- **Screenshot Management**: View, download, copy, and delete screenshots
- **Keyboard Shortcuts**: Ctrl+Shift+S (area), Ctrl+Shift+T (tab)
- **Modern UI**: Built with Tailwind CSS and custom design system

## Usage

1. Click the extension icon to open the popup
2. Choose "Select Area" or "Capture Tab"
3. For area selection, click and drag on the page
4. Access the sidebar to manage screenshots and submit to APIs
5. Use keyboard shortcuts for quick capture

## Development Notes

- Uses Chrome Extensions Manifest V3
- Built with Tailwind CSS for modern styling
- Supports high-DPI displays
- Stores up to 50 recent screenshots locally
- Fully responsive design