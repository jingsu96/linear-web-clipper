// Content script for Linear Web Clipper
// This script runs on all pages but does not inject any UI

console.log('[Linear Web Clipper] Content script loaded')

// Listen for messages from the background script if needed
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.type)

  // Handle any content-specific operations here if needed
  sendResponse({ success: true })
  return true
})
