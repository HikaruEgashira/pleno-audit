/**
 * API Hooks Script (Main World)
 * Intercepts fetch, XHR, WebSocket, Beacon, and dynamic resource loading
 */

;(function() {
  'use strict'

  // Prevent double initialization
  if (window.__SERVICE_DETECTION_CSP_INITIALIZED__) return
  window.__SERVICE_DETECTION_CSP_INITIALIZED__ = true

  // Save current APIs (may be already hooked by ai-hooks.js)
  // This allows chaining - our hook calls the previous hook
  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send
  const originalWebSocket = window.WebSocket
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator)

  // Debug: log if we're wrapping another hook
  if (window.__AI_PROMPT_CAPTURE_INITIALIZED__) {
    console.debug('[api-hooks] Chaining with ai-hooks.js')
  }

  const INSPECTION_BODY_SAMPLE_LIMIT = 4096

  function createSharedHookUtils() {
    function emitSecurityEvent(eventName, data) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }))
    }

    function getBodySize(body) {
      if (!body) return 0
      if (typeof body === 'string') return new Blob([body]).size
      if (body instanceof URLSearchParams) return new Blob([body.toString()]).size
      if (body instanceof Blob) return body.size
      if (body instanceof ArrayBuffer) return body.byteLength
      if (ArrayBuffer.isView(body)) return body.byteLength
      if (body instanceof FormData) {
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
      return 0
    }

    function getBodySample(body) {
      if (!body) return ''
      if (typeof body === 'string') return body.slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
      if (body instanceof URLSearchParams) return body.toString().slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
      if (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return ''
      if (body instanceof FormData) {
        let text = ''
        for (const [key, value] of body.entries()) {
          const part = typeof value === 'string'
            ? `${key}=${value}&`
            : `${key}=[binary]&`
          text += part
          if (text.length >= INSPECTION_BODY_SAMPLE_LIMIT) {
            return text.slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
          }
        }
        return text
      }
      if (typeof body === 'object' && body.constructor === Object) {
        try {
          return JSON.stringify(body).slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
        } catch {
          return ''
        }
      }
      return ''
    }

    function scheduleNetworkInspection({ url, method, initiator, body, pageUrl }) {
      const normalizedMethod = (method || 'GET').toUpperCase()
      if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return

      const bodySize = getBodySize(body)
      const payload = {
        url,
        method: normalizedMethod,
        initiator,
        pageUrl,
        timestamp: Date.now(),
        bodySize,
      }

      const dispatch = () => {
        const bodySample = getBodySample(body)
        if (bodySample) {
          emitSecurityEvent('__NETWORK_INSPECTION_REQUEST__', {
            ...payload,
            bodySample,
          })
          return
        }
        emitSecurityEvent('__NETWORK_INSPECTION_REQUEST__', payload)
      }

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => dispatch(), { timeout: 300 })
        return
      }
      setTimeout(dispatch, 0)
    }

    return {
      getBodySize,
      emitSecurityEvent,
      scheduleNetworkInspection,
    }
  }

  const sharedHookUtils = window.__PLENO_HOOKS_SHARED__ || createSharedHookUtils()
  window.__PLENO_HOOKS_SHARED__ = sharedHookUtils
  const {
    getBodySize,
    emitSecurityEvent,
    scheduleNetworkInspection,
  } = sharedHookUtils

  // ===== FETCH API HOOK =====
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    if (url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href
        const normalizedMethod = method.toUpperCase()
        const bodySize = getBodySize(body)

        emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
          url: fullUrl,
          method: normalizedMethod,
          initiator: 'fetch',
          resourceType: 'fetch',
          timestamp: Date.now(),
          bodySize: bodySize
        })
        scheduleNetworkInspection({
          url: fullUrl,
          method: normalizedMethod,
          initiator: 'fetch',
          body,
          pageUrl: window.location.href,
        })
      } catch (error) {
        console.debug('[api-hooks] Failed to inspect fetch URL.', error)
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

        emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
          url: fullUrl,
          method: method,
          initiator: 'xhr',
          resourceType: 'xhr',
          timestamp: Date.now(),
          bodySize: bodySize
        })
        scheduleNetworkInspection({
          url: fullUrl,
          method,
          initiator: 'xhr',
          body,
          pageUrl: window.location.href,
        })
      } catch (error) {
        console.debug('[api-hooks] Failed to inspect XHR URL.', error)
      }
    }
    return originalXHRSend.call(this, body)
  }

  // ===== WebSocket HOOK =====
  window.WebSocket = function(url, protocols) {
    emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
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

        emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
          url: fullUrl,
          method: 'POST',
          initiator: 'beacon',
          resourceType: 'beacon',
          timestamp: Date.now(),
          bodySize: bodySize
        })
        scheduleNetworkInspection({
          url: fullUrl,
          method: 'POST',
          initiator: 'beacon',
          body: data,
          pageUrl: window.location.href,
        })
      } catch (error) {
        console.debug('[api-hooks] Failed to inspect beacon URL.', error)
      }

      return originalSendBeacon(url, data)
    }
  }

  // ===== SUPPLY CHAIN RISK DETECTION =====

  // Check if URL is from external domain
  function isExternalResource(url) {
    try {
      const resourceUrl = new URL(url, window.location.origin)
      return resourceUrl.hostname !== window.location.hostname
    } catch {
      return false
    }
  }

  // Known CDN domains that should use SRI
  const knownCDNs = [
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'ajax.googleapis.com',
    'code.jquery.com',
    'stackpath.bootstrapcdn.com',
    'maxcdn.bootstrapcdn.com',
    'cdn.bootcdn.net',
    'lib.baomitu.com',
    'cdn.staticfile.org'
  ]

  function isKnownCDN(url) {
    try {
      const hostname = new URL(url, window.location.origin).hostname
      return knownCDNs.some(cdn => hostname.includes(cdn))
    } catch {
      return false
    }
  }

  // Check SRI (Subresource Integrity) for external scripts/stylesheets
  function checkSupplyChainRisk(element, resourceType) {
    const url = resourceType === 'script' ? element.src : element.href
    if (!url || !isExternalResource(url)) return

    const hasIntegrity = element.hasAttribute('integrity') && element.integrity
    const hasCrossorigin = element.hasAttribute('crossorigin')
    const isCDN = isKnownCDN(url)

    // Risk: CDN resource without SRI (only CDN resources are security-critical)
    if (!hasIntegrity && isCDN) {
      const risks = ['cdn_without_sri']
      if (!hasCrossorigin) risks.push('missing_crossorigin')

      emitSecurityEvent('__SUPPLY_CHAIN_RISK_DETECTED__', {
        url: url,
        resourceType: resourceType,
        hasIntegrity: false,
        hasCrossorigin: hasCrossorigin,
        isCDN: isCDN,
        risks: risks,
        timestamp: Date.now()
      })
    }
  }

  // ===== Dynamic Resource Loading Monitor (MutationObserver) =====
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue

        // Image
        if (node.tagName === 'IMG' && node.src) {
          emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
            url: node.src,
            method: 'GET',
            initiator: 'img',
            resourceType: 'img',
            timestamp: Date.now()
          })
        }

        // Script
        if (node.tagName === 'SCRIPT' && node.src) {
          emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
            url: node.src,
            method: 'GET',
            initiator: 'script',
            resourceType: 'script',
            timestamp: Date.now()
          })
          // Check for supply chain risk (external script without SRI)
          checkSupplyChainRisk(node, 'script')
        }

        // Link (stylesheet, etc.)
        if (node.tagName === 'LINK' && node.href) {
          const type = node.rel === 'stylesheet' ? 'style' : 'link'
          emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
            url: node.href,
            method: 'GET',
            initiator: type,
            resourceType: type,
            timestamp: Date.now()
          })
          // Check for supply chain risk (external stylesheet without SRI)
          if (node.rel === 'stylesheet') {
            checkSupplyChainRisk(node, 'stylesheet')
          }
        }

        // Iframe
        if (node.tagName === 'IFRAME' && node.src) {
          emitSecurityEvent('__SERVICE_DETECTION_NETWORK__', {
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

  // Check if form contains password or sensitive fields
  function hasSensitiveFields(form) {
    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card']
    const sensitiveNames = ['password', 'passwd', 'pwd', 'pass', 'secret', 'token', 'api_key', 'apikey', 'credit', 'card', 'cvv', 'ssn', 'otp', 'pin', 'auth', 'credential', '2fa', 'mfa']

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
        emitSecurityEvent('__CREDENTIAL_THEFT_DETECTED__', {
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
    } catch (error) {
      console.debug('[api-hooks] Failed to inspect form action.', error)
    }
  }, true)

  // ===== CLIPBOARD HIJACK DETECTION =====
  // Crypto wallet address patterns
  const CRYPTO_PATTERNS = {
    bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    ripple: /^r[0-9a-zA-Z]{24,34}$/,
  }

  function detectCryptoAddress(text) {
    for (const [type, pattern] of Object.entries(CRYPTO_PATTERNS)) {
      if (pattern.test(text)) return { detected: true, type }
    }
    return { detected: false, type: null }
  }

  // Hook Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = function(text) {
      const cryptoCheck = detectCryptoAddress(text)
      if (cryptoCheck.detected) {
        emitSecurityEvent('__CLIPBOARD_HIJACK_DETECTED__', {
          text: text.substring(0, 20) + '...',
          cryptoType: cryptoCheck.type,
          fullLength: text.length,
          timestamp: Date.now()
        })
      }
      return originalWriteText(text)
    }
  }

  // ===== COOKIE ACCESS DETECTION =====
  // Rate limiting to avoid flooding
  let lastCookieAccessTime = 0
  const COOKIE_ACCESS_THROTTLE = 1000  // 1 second

  try {
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    if (originalCookieDescriptor && originalCookieDescriptor.get) {
      const originalCookieGetter = originalCookieDescriptor.get

      Object.defineProperty(document, 'cookie', {
        get: function() {
          const now = Date.now()
          // Only report if enough time has passed
          if (now - lastCookieAccessTime > COOKIE_ACCESS_THROTTLE) {
            lastCookieAccessTime = now
            emitSecurityEvent('__COOKIE_ACCESS_DETECTED__', {
              timestamp: now,
              readCount: 1,
              pageUrl: window.location.href
            })
          }
          return originalCookieGetter.call(document)
        },
        set: originalCookieDescriptor.set,
        configurable: true
      })
    }
  } catch (error) {
    console.debug('[api-hooks] Cookie descriptor hook is unavailable.', error)
  }

  // ===== XSS AND DOM SCRAPING DETECTION =====
  // Track querySelectorAll calls for scraping detection
  let querySelectorAllCount = 0
  let querySelectorAllResetTime = Date.now()
  const SCRAPING_THRESHOLD = 50  // 50 calls in 5 seconds
  const SCRAPING_WINDOW = 5000   // 5 seconds

  const originalQuerySelectorAll = document.querySelectorAll.bind(document)
  document.querySelectorAll = function(selector) {
    const now = Date.now()
    if (now - querySelectorAllResetTime > SCRAPING_WINDOW) {
      querySelectorAllCount = 0
      querySelectorAllResetTime = now
    }
    querySelectorAllCount++

    if (querySelectorAllCount === SCRAPING_THRESHOLD) {
      emitSecurityEvent('__DOM_SCRAPING_DETECTED__', {
        selector: selector,
        callCount: querySelectorAllCount,
        timestamp: now
      })
    }

    return originalQuerySelectorAll(selector)
  }

  // XSS pattern detection in innerHTML/outerHTML
  // Strict patterns to reduce false positives
  const XSS_PATTERNS = [
    /<script[^>]*>[^<]+/i,                          // Script tag with content (not empty)
    /javascript:\s*[^"'\s]/i,                       // javascript: URL with actual code
    /on(error|load)\s*=\s*["'][^"']*eval/i,         // Event handlers containing eval
    /<iframe[^>]*src\s*=\s*["']?javascript:/i,      // iframe with javascript: src
  ]

  function detectXSSPayload(html) {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(html)) return true
    }
    return false
  }

  // Hook innerHTML setter
  const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  if (originalInnerHTMLDescriptor && originalInnerHTMLDescriptor.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      get: originalInnerHTMLDescriptor.get,
      set: function(value) {
        if (typeof value === 'string' && detectXSSPayload(value)) {
          emitSecurityEvent('__XSS_DETECTED__', {
            type: 'innerHTML',
            payloadPreview: value.substring(0, 100),
            timestamp: Date.now()
          })
        }
        return originalInnerHTMLDescriptor.set.call(this, value)
      },
      configurable: true
    })
  }

  // ===== SUSPICIOUS DOWNLOAD DETECTION =====
  const SUSPICIOUS_EXTENSIONS = ['.exe', '.msi', '.bat', '.ps1', '.cmd', '.scr', '.vbs', '.js', '.jar', '.dll']

  // Hook URL.createObjectURL for blob downloads
  const originalCreateObjectURL = URL.createObjectURL
  URL.createObjectURL = function(blob) {
    if (blob instanceof Blob) {
      emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
        type: 'blob',
        size: blob.size,
        mimeType: blob.type,
        timestamp: Date.now()
      })
    }
    return originalCreateObjectURL.call(this, blob)
  }

  // Monitor clicks on anchor elements with download attribute
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLAnchorElement)) return
    if (!target.download && !target.href) return

    try {
      const href = target.href || ''
      const download = target.download || ''

      // Check for blob: or data: URLs
      if (href.startsWith('blob:') || href.startsWith('data:')) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: href.startsWith('blob:') ? 'blob_link' : 'data_url',
          filename: download,
          timestamp: Date.now()
        })
        return
      }

      // Check for suspicious file extensions
      const filename = download || href.split('/').pop() || ''
      const extension = '.' + filename.split('.').pop().toLowerCase()
      if (SUSPICIOUS_EXTENSIONS.includes(extension)) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: 'suspicious_extension',
          filename: filename,
          extension: extension,
          url: href,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.debug('[api-hooks] Failed to inspect download click.', error)
    }
  }, true)
})()
