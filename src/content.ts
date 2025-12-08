// Content script for injecting CSS into web pages
// This script runs on all web pages and listens for style injection commands

// NOTE: This file cannot use imports due to Chrome extension content script limitations
// URL matching logic is duplicated from utils/urlMatcher.ts

interface Preset {
  id: string
  name: string
  css: string
  urlPatterns: string[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// Create or get the style element for injected CSS
let styleElement: HTMLStyleElement | null = null

function getOrCreateStyleElement (): HTMLStyleElement {
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'restyle-injected-styles'
    document.head.appendChild(styleElement)
  }
  return styleElement
}

// Convert glob pattern to regex
function patternToRegex (pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${regexPattern}$`)
}

// Check if URL matches pattern
function matchesPattern (url: string, pattern: string): boolean {
  try {
    const regex = patternToRegex(pattern)
    return regex.test(url)
  } catch {
    return false
  }
}

// Count wildcards for specificity
function countWildcards (pattern: string): number {
  return (pattern.match(/\*/g) || []).length
}

// Find matching presets sorted by specificity
function findMatchingPresets (url: string, presets: Preset[], enabledOnly: boolean): Preset[] {
  return presets
    .filter((preset) => {
      if (enabledOnly && !preset.enabled) return false
      return preset.urlPatterns.some((pattern) => matchesPattern(url, pattern))
    })
    .sort((a, b) => {
      const aWildcards = countWildcards(a.urlPatterns[0] || '')
      const bWildcards = countWildcards(b.urlPatterns[0] || '')
      return aWildcards - bWildcards
    })
}

// Combine CSS from presets
function combineCss (presets: Preset[]): string {
  return presets.map((p) => p.css).join('\n\n')
}

// Boost CSS specificity by adding high-specificity suffix to selectors
// and ensuring all declarations have !important
// :not(#\9) adds specificity of an ID selector without matching anything
// #\9 is an escaped tab character which is never used as an actual ID
function boostSpecificity (css: string): string {
  const specificityBooster = ':not(#\\9):not(#\\9):not(#\\9)'

  // First, boost selector specificity
  let boosted = css.replace(
    /([^{}@]+)(\{[^{}]*\})/g,
    (match, selectors, block) => {
      // Don't modify @rules (media queries, keyframes, etc.)
      if (selectors.trim().startsWith('@')) return match

      const boostedSelectors = selectors
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .map((s: string) => `${s}${specificityBooster}`)
        .join(', ')

      return `${boostedSelectors}${block}`
    }
  )

  // Then, add !important to all declarations (remove existing ones first to avoid duplicates)
  boosted = boosted.replace(
    /([^:;{}]+):\s*([^;{}]+?)\s*(!important)?(\s*[;}])/g,
    (match, prop, value, _important, ending) => {
      return `${prop}: ${value.trim()} !important${ending}`
    }
  )

  return boosted
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
      style.textContent = boostSpecificity(message.css || '')
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
    style.textContent = boostSpecificity(combineCss(matchingPresets))
  }
}

// Apply preset on page load
loadPresetForCurrentUrl()
