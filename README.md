# Restyle

A Chrome extension that injects custom CSS styles into websites. Edit and preview styles in real-time using the side panel, save them as presets, and automatically apply them to specific sites.

## Features

- **Real-time CSS Editor**: Edit CSS in the side panel and see changes instantly
- **Preset Management**: Save frequently used styles as presets
- **URL Pattern Matching**: Specify which sites each preset applies to (supports wildcards)
- **Auto-apply**: Automatically apply matching presets when pages load

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build

Development build (watch mode):

```bash
npm run dev
```

Production build:

```bash
npm run build
```

After building, extension files will be generated in the `dist` directory.

### 3. Load Extension in Chrome

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `dist` directory

### 4. Icon Setup (Optional)

Place a 128x128 pixel icon at `public/icons/icon-128.png`.
If you don't have an icon, you can create a placeholder with this command:

```bash
# Create a simple icon using ImageMagick
convert -size 128x128 xc:#667eea -gravity center -pointsize 48 -fill white -annotate +0+0 "Re" public/icons/icon-128.png
```

## Usage

### Basic Usage

1. Click the Restyle icon in the Chrome toolbar to open the side panel
2. Enter styles in the CSS editor
3. Click "Apply" to apply styles to the current page
4. Click "Clear" to reset styles

### Creating Presets

1. Create styles in the CSS editor
2. Enter a preset name
3. Enter URL patterns to apply (e.g., `https://example.com/*`)
4. Click "Save"

### URL Pattern Examples

- `https://example.com/*` - All pages on example.com
- `https://example.com/blog/*` - Pages under /blog/ on example.com
- `https://*.example.com/*` - All subdomains of example.com
- `*://example.com/*` - Both HTTP and HTTPS

### Managing Presets

- **Load**: Load a preset into the editor and apply it
- **Edit**: Modify preset name or URL patterns
- **Delete**: Remove a preset

## Project Structure

```
restyle/
├── public/
│   ├── icons/
│   │   └── icon-128.png      # Extension icon
│   ├── manifest.json          # Chrome extension manifest
│   └── sidepanel.html         # Side panel HTML
├── src/
│   ├── background.ts          # Background service worker
│   ├── content.ts             # Content script (style injection)
│   ├── types.ts               # TypeScript type definitions
│   └── sidepanel/
│       ├── App.tsx            # Side panel main component
│       ├── main.tsx           # Entry point
│       └── styles.css         # Stylesheet
├── dist/                      # Build output (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Tech Stack

- **TypeScript**: Type-safe development
- **React**: Side panel UI
- **Vite**: Fast build tool
- **Chrome Extension Manifest V3**: Latest Chrome extension spec
- **Chrome Side Panel API**: Side panel UI

## Development

### Hot Reload

Run `npm run dev` during development to watch for file changes.
After modifying source code, click the "Reload" button on Chrome's extensions page.

### Debugging

- **Side Panel**: Right-click on the side panel → "Inspect"
- **Background Script**: `chrome://extensions/` → Click "Service Worker"
- **Content Script**: Right-click on page → "Inspect" → Console tab

## License

AGPL-3.0
