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

  // Configuration for data exfiltration detection
  const DATA_EXFILTRATION_THRESHOLD = 100 * 1024  // 100KB threshold

  // Helper to dispatch network event to content script
  function sendNetworkEvent(data) {
    window.dispatchEvent(
      new CustomEvent('__SERVICE_DETECTION_NETWORK__', { detail: data })
    )
  }

  // Helper to dispatch data exfiltration event
  function sendDataExfiltrationEvent(data) {
    window.dispatchEvent(
      new CustomEvent('__DATA_EXFILTRATION_DETECTED__', { detail: data })
    )
  }

  // Calculate body size in bytes
  function getBodySize(body) {
    if (!body) return 0
    if (typeof body === 'string') return new Blob([body]).size
    if (body instanceof Blob) return body.size
    if (body instanceof ArrayBuffer) return body.byteLength
    if (body instanceof FormData) {
      // Estimate FormData size (not exact but reasonable approximation)
      let size = 0
      for (const [key, value] of body.entries()) {
        size += key.length
        if (typeof value === 'string') {
          size += value.length
        } else if (value instanceof Blob) {
          size += value.size
        }
      }
      return size
    }
    if (typeof body === 'object') return new Blob([JSON.stringify(body)]).size
    return 0
  }

  // ===== FETCH API HOOK =====
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    if (url) {
      const fullUrl = new URL(url, window.location.origin).href
      const bodySize = getBodySize(body)

      sendNetworkEvent({
        url: fullUrl,
        method: method.toUpperCase(),
        initiator: 'fetch',
        resourceType: 'fetch',
        timestamp: Date.now(),
        bodySize: bodySize
      })

      // Check for potential data exfiltration (large outbound data)
      if (bodySize >= DATA_EXFILTRATION_THRESHOLD && method.toUpperCase() !== 'GET') {
        sendDataExfiltrationEvent({
          url: fullUrl,
          method: method.toUpperCase(),
          bodySize: bodySize,
          initiator: 'fetch',
          timestamp: Date.now(),
          targetDomain: new URL(fullUrl).hostname
        })
      }
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
      const fullUrl = new URL(this.__serviceDetectionUrl, window.location.origin).href
      const method = (this.__serviceDetectionMethod || 'GET').toUpperCase()
      const bodySize = getBodySize(body)

      sendNetworkEvent({
        url: fullUrl,
        method: method,
        initiator: 'xhr',
        resourceType: 'xhr',
        timestamp: Date.now(),
        bodySize: bodySize
      })

      // Check for potential data exfiltration (large outbound data)
      if (bodySize >= DATA_EXFILTRATION_THRESHOLD && method !== 'GET') {
        sendDataExfiltrationEvent({
          url: fullUrl,
          method: method,
          bodySize: bodySize,
          initiator: 'xhr',
          timestamp: Date.now(),
          targetDomain: new URL(fullUrl).hostname
        })
      }
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
      const fullUrl = new URL(url, window.location.origin).href
      const bodySize = getBodySize(data)

      sendNetworkEvent({
        url: fullUrl,
        method: 'POST',
        initiator: 'beacon',
        resourceType: 'beacon',
        timestamp: Date.now(),
        bodySize: bodySize
      })

      // Check for potential data exfiltration (large outbound data)
      if (bodySize >= DATA_EXFILTRATION_THRESHOLD) {
        sendDataExfiltrationEvent({
          url: fullUrl,
          method: 'POST',
          bodySize: bodySize,
          initiator: 'beacon',
          timestamp: Date.now(),
          targetDomain: new URL(fullUrl).hostname
        })
      }

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
