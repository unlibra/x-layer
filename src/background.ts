// Background service worker for X-Layer extension
// Handles extension icon clicks and communication between sidepanel and content scripts

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Sample presets to install on first run
const samplePresets = [
  {
    id: 'sample-hide-images',
    name: '画像を非表示',
    css: 'img {\n  display: none;\n}\n',
    urlPatterns: ['https://*/*'],
    enabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'sample-font-change',
    name: 'フォント変更',
    css: `* {
  font-family: "Noto Sans", sans-serif;
}
`,
    urlPatterns: ['https://*/*'],
    enabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('X-Layer extension installed')

  // Only install sample presets on fresh install (not updates)
  if (details.reason === 'install') {
    const result = await chrome.storage.local.get('presets')
    if (!result.presets || result.presets.length === 0) {
      await chrome.storage.local.set({ presets: samplePresets })
      console.log('Sample presets installed')
    }
  }
})

// Message handler for communication between sidepanel and content scripts
chrome.runtime.onMessage.addListener(
  (
    message: {
      type: string
      css?: string
      presetId?: string
    },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (message.type === 'APPLY_CSS') {
      // Forward CSS to active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'INJECT_CSS',
            css: message.css,
          }).catch(() => {
            // Ignore errors when sending to pages where content script isn't running
            // (e.g. chrome:// URLs or empty tabs)
          })
        }
      })
    } else if (message.type === 'GET_CURRENT_TAB') {
      // Get current tab URL and title for preset matching
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({
          url: tabs[0]?.url || '',
          title: tabs[0]?.title || '',
        })
      })
      return true // Keep message channel open for async response
    }
  }
)
