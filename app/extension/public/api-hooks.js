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
      try {
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
      } catch {
        // Skip detection on invalid URL, but don't block original request
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
      try {
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
      } catch {
        // Skip detection on invalid URL, but don't block original request
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
      try {
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
      } catch {
        // Skip detection on invalid URL, but don't block original request
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

  // ===== CREDENTIAL THEFT DETECTION =====
  // Helper to dispatch credential theft event
  function sendCredentialTheftEvent(data) {
    window.dispatchEvent(
      new CustomEvent('__CREDENTIAL_THEFT_DETECTED__', { detail: data })
    )
  }

  // Check if form contains password or sensitive fields
  function hasSensitiveFields(form) {
    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card']
    const sensitiveNames = ['password', 'passwd', 'pwd', 'pass', 'secret', 'token', 'api_key', 'apikey', 'credit', 'card', 'cvv', 'ssn']

    const inputs = form.querySelectorAll('input')
    for (const input of inputs) {
      const type = (input.type || '').toLowerCase()
      const name = (input.name || '').toLowerCase()
      const id = (input.id || '').toLowerCase()
      const autocomplete = (input.autocomplete || '').toLowerCase()

      // Check input type
      if (sensitiveTypes.includes(type)) return { hasSensitive: true, fieldType: type }

      // Check input name/id for sensitive patterns
      for (const pattern of sensitiveNames) {
        if (name.includes(pattern) || id.includes(pattern)) {
          return { hasSensitive: true, fieldType: pattern }
        }
      }

      // Check autocomplete attribute
      if (autocomplete.includes('password') || autocomplete.includes('cc-')) {
        return { hasSensitive: true, fieldType: autocomplete }
      }
    }

    return { hasSensitive: false, fieldType: null }
  }

  // Monitor form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return

    try {
      const action = form.action || window.location.href
      const actionUrl = new URL(action, window.location.origin)
      const isSecure = actionUrl.protocol === 'https:'
      const targetDomain = actionUrl.hostname
      const currentDomain = window.location.hostname
      const isCrossOrigin = targetDomain !== currentDomain

      const { hasSensitive, fieldType } = hasSensitiveFields(form)

      // Only alert if form contains sensitive fields
      if (hasSensitive) {
        const risks = []

        // Risk 1: Non-HTTPS submission
        if (!isSecure) {
          risks.push('insecure_protocol')
        }

        // Risk 2: Cross-origin submission
        if (isCrossOrigin) {
          risks.push('cross_origin')
        }

        // Always report sensitive form submissions for monitoring
        sendCredentialTheftEvent({
          formAction: actionUrl.href,
          targetDomain: targetDomain,
          method: (form.method || 'GET').toUpperCase(),
          isSecure: isSecure,
          isCrossOrigin: isCrossOrigin,
          fieldType: fieldType,
          risks: risks,
          timestamp: Date.now()
        })
      }
    } catch {
      // Skip detection on invalid form action
    }
  }, true)
})()
