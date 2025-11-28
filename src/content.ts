// Content script for injecting CSS into web pages
// This script runs on all web pages and listens for style injection commands

// Create or get the style element for injected CSS
let styleElement: HTMLStyleElement | null = null

function getOrCreateStyleElement (): HTMLStyleElement {
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'x-layer-injected-styles'
    document.head.appendChild(styleElement)
  }
  return styleElement
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; css?: string },
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void
  ) => {
    if (message.type === 'INJECT_CSS') {
      const style = getOrCreateStyleElement()
      style.textContent = message.css || ''
    } else if (message.type === 'CLEAR_CSS') {
      if (styleElement) {
        styleElement.textContent = ''
      }
    }
  }
)

// Load and apply saved preset for current URL on page load
async function loadPresetForCurrentUrl () {
  const currentUrl = window.location.href

  // Get all presets from storage
  const result = await chrome.storage.local.get('presets')
  const presets: Array<{
    id: string
    name: string
    css: string
    urlPatterns: string[]
  }> = result.presets || []

  // Find matching preset
  for (const preset of presets) {
    for (const pattern of preset.urlPatterns) {
      try {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
        const regex = new RegExp(`^${regexPattern}$`)

        if (regex.test(currentUrl)) {
          // Apply matching preset
          const style = getOrCreateStyleElement()
          style.textContent = preset.css
          return
        }
      } catch (error) {
        console.error('Invalid URL pattern:', pattern, error)
      }
    }
  }
}

// Apply preset on page load
loadPresetForCurrentUrl()
