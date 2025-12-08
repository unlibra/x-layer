// Content script for injecting CSS into web pages
// This script runs on all web pages and listens for style injection commands

import type { Preset } from './types'
import { combineCss, findMatchingPresets } from './utils/urlMatcher'

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

// Load and apply saved presets for current URL on page load
async function loadPresetForCurrentUrl () {
  const currentUrl = window.location.href

  // Get all presets from storage
  const result = await chrome.storage.local.get('presets')
  const presets: Preset[] = result.presets || []

  // Find all matching enabled presets, sorted by specificity
  const matchingPresets = findMatchingPresets(currentUrl, presets, true)

  if (matchingPresets.length > 0) {
    const style = getOrCreateStyleElement()
    style.textContent = combineCss(matchingPresets)
  }
}

// Apply preset on page load
loadPresetForCurrentUrl()
