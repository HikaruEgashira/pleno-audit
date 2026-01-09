/**
 * API Hooks Script (Main World)
 * Intercepts fetch, XHR, WebSocket, Beacon, and dynamic resource loading
 */

;(function() {
  'use strict'

  // Prevent double initialization
  if (window.__SERVICE_DETECTION_CSP_INITIALIZED__) return
  window.__SERVICE_DETECTION_CSP_INITIALIZED__ = true

  // Save original APIs
  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send
  const originalWebSocket = window.WebSocket
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator)

  // Helper to dispatch network event to content script
  function sendNetworkEvent(data) {
    window.dispatchEvent(
      new CustomEvent('__SERVICE_DETECTION_NETWORK__', { detail: data })
    )
  }

  // ===== FETCH API HOOK =====
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'

    if (url) {
      sendNetworkEvent({
        url: new URL(url, window.location.origin).href,
        method: method.toUpperCase(),
        initiator: 'fetch',
        resourceType: 'fetch',
        timestamp: Date.now()
      })
    }

    return originalFetch.apply(this, arguments)
  }

  // ===== XMLHttpRequest HOOK =====
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__serviceDetectionUrl = url
    this.__serviceDetectionMethod = method
    return originalXHROpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function(body) {
    if (this.__serviceDetectionUrl) {
      sendNetworkEvent({
        url: new URL(this.__serviceDetectionUrl, window.location.origin).href,
        method: (this.__serviceDetectionMethod || 'GET').toUpperCase(),
        initiator: 'xhr',
        resourceType: 'xhr',
        timestamp: Date.now()
      })
    }
    return originalXHRSend.call(this, body)
  }

  // ===== WebSocket HOOK =====
  window.WebSocket = function(url, protocols) {
    sendNetworkEvent({
      url: url,
      method: 'WEBSOCKET',
      initiator: 'websocket',
      resourceType: 'websocket',
      timestamp: Date.now()
    })

    if (protocols !== undefined) {
      return new originalWebSocket(url, protocols)
    }
    return new originalWebSocket(url)
  }

  // Preserve WebSocket prototype and constants
  window.WebSocket.prototype = originalWebSocket.prototype
  window.WebSocket.CONNECTING = originalWebSocket.CONNECTING
  window.WebSocket.OPEN = originalWebSocket.OPEN
  window.WebSocket.CLOSING = originalWebSocket.CLOSING
  window.WebSocket.CLOSED = originalWebSocket.CLOSED

  // ===== Beacon API HOOK =====
  if (originalSendBeacon) {
    navigator.sendBeacon = function(url, data) {
      sendNetworkEvent({
        url: new URL(url, window.location.origin).href,
        method: 'POST',
        initiator: 'beacon',
        resourceType: 'beacon',
        timestamp: Date.now()
      })

      return originalSendBeacon(url, data)
    }
  }

  // ===== Dynamic Resource Loading Monitor (MutationObserver) =====
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue

        // Image
        if (node.tagName === 'IMG' && node.src) {
          sendNetworkEvent({
            url: node.src,
            method: 'GET',
            initiator: 'img',
            resourceType: 'img',
            timestamp: Date.now()
          })
        }

        // Script
        if (node.tagName === 'SCRIPT' && node.src) {
          sendNetworkEvent({
            url: node.src,
            method: 'GET',
            initiator: 'script',
            resourceType: 'script',
            timestamp: Date.now()
          })
        }

        // Link (stylesheet, etc.)
        if (node.tagName === 'LINK' && node.href) {
          const type = node.rel === 'stylesheet' ? 'style' : 'link'
          sendNetworkEvent({
            url: node.href,
            method: 'GET',
            initiator: type,
            resourceType: type,
            timestamp: Date.now()
          })
        }

        // Iframe
        if (node.tagName === 'IFRAME' && node.src) {
          sendNetworkEvent({
            url: node.src,
            method: 'GET',
            initiator: 'frame',
            resourceType: 'frame',
            timestamp: Date.now()
          })
        }
      }
    }
  })

  // Start observing DOM changes
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true })
    })
  }
})()
