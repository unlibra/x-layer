// Background service worker for X-Layer extension
// Handles extension icon clicks and communication between sidepanel and content scripts

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('X-Layer extension installed')
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
