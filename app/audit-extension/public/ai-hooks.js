/**
 * AI Prompt Capture Script (Main World)
 * リクエスト構造による汎用AIサービス検出とプロンプト/レスポンスキャプチャ
 */

;(function() {
  'use strict'

  // Prevent double initialization
  if (window.__AI_PROMPT_CAPTURE_INITIALIZED__) return
  window.__AI_PROMPT_CAPTURE_INITIALIZED__ = true

  console.log('[ai-hooks] Initializing security hooks')

  // Configuration
  const MAX_CONTENT_SIZE = 50000  // 50KB max capture
  const TRUNCATE_SIZE = 10000     // Truncate after 10KB

  // Save current APIs (may be already hooked by api-hooks.js)
  // This allows chaining - our hook calls the previous hook
  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send

  // Debug: log if we're wrapping another hook
  if (window.__SERVICE_DETECTION_CSP_INITIALIZED__) {
    console.debug('[ai-hooks] Chaining with api-hooks.js')
  }

  const sharedHookUtils = window.__PLENO_HOOKS_SHARED__
  const emitSecurityEvent = sharedHookUtils?.emitSecurityEvent
    ?? ((eventName, data) => window.dispatchEvent(new CustomEvent(eventName, { detail: data })))

  function isAIRequestBody(body) {
    if (!body) return false

    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      if (!obj || typeof obj !== 'object') return false

      // Chat Completion format: { messages: [...], model: "..." }
      if (isMessagesArray(obj.messages)) {
        return true
      }

      // Completion format: { prompt: "...", model: "..." }
      if (typeof obj.prompt === 'string' && typeof obj.model === 'string') {
        return true
      }

      // Gemini format: { contents: [{ parts: [...] }] }
      if (isGeminiContents(obj.contents)) {
        return true
      }

      // ChatGPT internal format: { action: "next"|"variant", conversation_id, model }
      if (isChatGPTConversation(obj)) {
        return true
      }

      return false
    } catch {
      return false
    }
  }

  // ChatGPT internal conversation API format
  function isChatGPTConversation(obj) {
    // ChatGPT uses action: "next" | "variant" | "continue" with conversation_id
    if (typeof obj.action === 'string' &&
        ['next', 'variant', 'continue'].includes(obj.action) &&
        typeof obj.conversation_id === 'string') {
      return true
    }
    // New conversation: action with messages array
    if (typeof obj.action === 'string' &&
        obj.action === 'next' &&
        Array.isArray(obj.messages)) {
      return true
    }
    return false
  }

  function isMessagesArray(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return false
    return messages.some(m =>
      m && typeof m === 'object' && (
        // Standard Chat Completion format: { role: "user", content: "..." }
        (typeof m.role === 'string' && ('content' in m || 'parts' in m)) ||
        // ChatGPT internal format: { author: { role: "user" }, content: { parts: [...] } }
        (m.author && typeof m.author.role === 'string' && m.content && Array.isArray(m.content.parts))
      )
    )
  }

  function isGeminiContents(contents) {
    if (!Array.isArray(contents) || contents.length === 0) return false
    return contents.some(c =>
      c && typeof c === 'object' &&
      'parts' in c &&
      Array.isArray(c.parts) &&
      c.parts.some(p => p && typeof p === 'object' && 'text' in p)
    )
  }

  function extractPrompt(body) {
    if (!body) return null

    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      const contentSize = bodyStr.length
      const truncated = contentSize > TRUNCATE_SIZE

      // Chat Completion format (including ChatGPT internal format)
      if (isMessagesArray(obj.messages)) {
        return {
          messages: obj.messages.map(m => ({
            role: m.role || m.author?.role || 'user',
            content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
          })),
          contentSize,
          truncated,
          model: obj.model,
        }
      }

      // Completion format
      if (typeof obj.prompt === 'string') {
        return {
          text: truncateString(obj.prompt, TRUNCATE_SIZE),
          contentSize,
          truncated,
          model: obj.model,
        }
      }

      // Gemini format
      if (isGeminiContents(obj.contents)) {
        const messages = obj.contents.map(c => ({
          role: c.role || 'user',
          content: truncateString(
            c.parts.map(p => p.text || '').join(''),
            TRUNCATE_SIZE
          ),
        }))
        return {
          messages,
          contentSize,
          truncated,
          model: obj.model,
        }
      }

      // ChatGPT conversation format (action-based)
      if (isChatGPTConversation(obj)) {
        return {
          chatgptAction: obj.action,
          conversationId: obj.conversation_id,
          parentMessageId: obj.parent_message_id,
          contentSize,
          truncated,
          model: obj.model,
        }
      }

      // Raw body
      return {
        rawBody: truncateString(bodyStr, TRUNCATE_SIZE),
        contentSize,
        truncated,
      }
    } catch {
      const bodyStr = String(body)
      return {
        rawBody: truncateString(bodyStr, TRUNCATE_SIZE),
        contentSize: bodyStr.length,
        truncated: bodyStr.length > TRUNCATE_SIZE,
      }
    }
  }

  function extractMessageContent(message) {
    if (typeof message.content === 'string') {
      return message.content
    }
    if (Array.isArray(message.content)) {
      return message.content
        .map(c => {
          if (typeof c === 'string') return c
          if (c.type === 'text' && typeof c.text === 'string') return c.text
          return ''
        })
        .join('')
    }
    // ChatGPT internal format: content: { content_type: "text", parts: ["..."] }
    if (message.content && Array.isArray(message.content.parts)) {
      return message.content.parts
        .map(p => typeof p === 'string' ? p : (p.text || ''))
        .join('')
    }
    if (typeof message.text === 'string') {
      return message.text
    }
    return ''
  }

  function extractResponse(text, isStreaming) {
    const contentSize = text.length
    const truncated = contentSize > TRUNCATE_SIZE

    const result = {
      contentSize,
      truncated,
      isStreaming,
    }

    try {
      // Streaming response
      if (isStreaming || text.includes('data: ')) {
        result.text = extractStreamingContent(text)
        return result
      }

      // Normal JSON response
      const obj = JSON.parse(text)

      // OpenAI format: choices[].message.content
      if (obj.choices?.[0]?.message?.content) {
        result.text = truncateString(obj.choices[0].message.content, TRUNCATE_SIZE)
      } else if (obj.choices?.[0]?.text) {
        result.text = truncateString(obj.choices[0].text, TRUNCATE_SIZE)
      }
      // Anthropic format: content[].text
      else if (obj.content?.[0]?.text) {
        result.text = truncateString(obj.content[0].text, TRUNCATE_SIZE)
      }
      // Gemini format: candidates[].content.parts[].text
      else if (obj.candidates?.[0]?.content?.parts?.[0]?.text) {
        result.text = truncateString(obj.candidates[0].content.parts[0].text, TRUNCATE_SIZE)
      }

      // Usage info
      if (obj.usage) {
        result.usage = {
          promptTokens: obj.usage.prompt_tokens ?? obj.usage.input_tokens,
          completionTokens: obj.usage.completion_tokens ?? obj.usage.output_tokens,
          totalTokens: obj.usage.total_tokens,
        }
      }
    } catch {
      result.text = truncateString(text, TRUNCATE_SIZE)
    }

    return result
  }

  function extractStreamingContent(text) {
    const chunks = []
    const lines = text.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      if (line.includes('[DONE]')) continue

      try {
        const data = JSON.parse(line.slice(6))

        // OpenAI delta
        const deltaContent = data.choices?.[0]?.delta?.content
        if (deltaContent) {
          chunks.push(deltaContent)
          continue
        }

        // Anthropic delta
        const anthropicDelta = data.delta?.text
        if (anthropicDelta) {
          chunks.push(anthropicDelta)
          continue
        }

        // Gemini streaming
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (geminiText) {
          chunks.push(geminiText)
        }
      } catch {
        // skip invalid JSON
      }
    }

    return truncateString(chunks.join(''), TRUNCATE_SIZE)
  }

  function truncateString(str, maxLength) {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength)
  }

  function generateId() {
    return crypto.randomUUID()
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    // Only check POST/PUT requests with body for AI capture
    if (!body || method === 'GET') {
      return originalFetch.apply(this, arguments)
    }

    // Check if this is an AI request by body structure
    if (!isAIRequestBody(body)) {
      return originalFetch.apply(this, arguments)
    }

    const startTime = Date.now()
    const promptContent = extractPrompt(body)

    const captureData = {
      id: generateId(),
      timestamp: startTime,
      pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: method.toUpperCase(),
      prompt: promptContent,
      model: promptContent?.model,
    }

    try {
      const response = await originalFetch.apply(this, arguments)

      // Clone response to read body
      const clonedResponse = response.clone()

      // Check if streaming
      const contentType = response.headers.get('content-type') || ''
      const isStreaming = contentType.includes('text/event-stream') ||
                          contentType.includes('application/x-ndjson')

      // Read response (async, fire-and-forget)
      clonedResponse.text().then(text => {
        if (text.length > MAX_CONTENT_SIZE) {
          // Still send capture but without response
          emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
          return
        }

        captureData.response = extractResponse(text, isStreaming)
        captureData.responseTimestamp = Date.now()
        captureData.response.latencyMs = Date.now() - startTime

        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      }).catch(() => {
        // Send without response on error
        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      })

      return response
    } catch (error) {
      // Send capture even on error
      emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      throw error
    }
  }

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__aiCaptureUrl = url
    this.__aiCaptureMethod = method
    return originalXHROpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function(body) {
    const url = this.__aiCaptureUrl
    const method = this.__aiCaptureMethod

    if (!body || method === 'GET') {
      return originalXHRSend.call(this, body)
    }

    if (!isAIRequestBody(body)) {
      return originalXHRSend.call(this, body)
    }

    const startTime = Date.now()
    const promptContent = extractPrompt(body)

    const captureData = {
      id: generateId(),
      timestamp: startTime,
      pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: (method || 'POST').toUpperCase(),
      prompt: promptContent,
      model: promptContent?.model,
    }

    const xhr = this
    const originalOnReadyStateChange = xhr.onreadystatechange

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        try {
          const responseText = xhr.responseText
          if (responseText && responseText.length <= MAX_CONTENT_SIZE) {
            const contentType = xhr.getResponseHeader('content-type') || ''
            const isStreaming = contentType.includes('text/event-stream')

            captureData.response = extractResponse(responseText, isStreaming)
            captureData.responseTimestamp = Date.now()
            captureData.response.latencyMs = Date.now() - startTime
          }
        } catch (error) {
          console.debug('[ai-hooks] Failed to parse XHR response for AI capture.', error)
        }

        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      }

      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments)
      }
    }

    return originalXHRSend.call(this, body)
  }

  // ===== CLIPBOARD HIJACK DETECTION =====
  const CRYPTO_PATTERNS = {
    bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
  }

  function detectCryptoAddress(text) {
    for (const [type, pattern] of Object.entries(CRYPTO_PATTERNS)) {
      if (pattern.test(text)) return { detected: true, type }
    }
    return { detected: false, type: null }
  }

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
  let lastCookieAccessTime = 0
  const COOKIE_ACCESS_THROTTLE = 1000

  try {
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    if (originalCookieDescriptor && originalCookieDescriptor.get) {
      const originalCookieGetter = originalCookieDescriptor.get
      Object.defineProperty(document, 'cookie', {
        get: function() {
          const now = Date.now()
          if (now - lastCookieAccessTime > COOKIE_ACCESS_THROTTLE) {
            lastCookieAccessTime = now
            emitSecurityEvent('__COOKIE_ACCESS_DETECTED__', { timestamp: now, readCount: 1, pageUrl: window.location.href })
          }
          return originalCookieGetter.call(document)
        },
        set: originalCookieDescriptor.set,
        configurable: true
      })
    }
  } catch (error) {
    console.debug('[ai-hooks] Cookie descriptor hook is unavailable.', error)
  }

  // ===== XSS AND DOM SCRAPING DETECTION =====
  let querySelectorAllCount = 0
  let querySelectorAllResetTime = Date.now()
  const SCRAPING_THRESHOLD = 50
  const SCRAPING_WINDOW = 5000

  const originalQuerySelectorAll = document.querySelectorAll.bind(document)
  document.querySelectorAll = function(selector) {
    const now = Date.now()
    if (now - querySelectorAllResetTime > SCRAPING_WINDOW) {
      querySelectorAllCount = 0
      querySelectorAllResetTime = now
    }
    querySelectorAllCount++
    if (querySelectorAllCount === SCRAPING_THRESHOLD) {
      emitSecurityEvent('__DOM_SCRAPING_DETECTED__', { selector, callCount: querySelectorAllCount, timestamp: now })
    }
    return originalQuerySelectorAll(selector)
  }

  const XSS_PATTERNS = [/<script[^>]*>/i, /javascript:/i, /on\w+\s*=/i, /<iframe[^>]*>/i]

  function detectXSSPayload(html) {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(html)) return true
    }
    return false
  }

  const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  if (originalInnerHTMLDescriptor && originalInnerHTMLDescriptor.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      get: originalInnerHTMLDescriptor.get,
      set: function(value) {
        if (typeof value === 'string' && detectXSSPayload(value)) {
          emitSecurityEvent('__XSS_DETECTED__', { type: 'innerHTML', payloadPreview: value.substring(0, 100), timestamp: Date.now() })
        }
        return originalInnerHTMLDescriptor.set.call(this, value)
      },
      configurable: true
    })
  }

  // ===== SUSPICIOUS DOWNLOAD DETECTION =====
  const originalCreateObjectURL = URL.createObjectURL
  URL.createObjectURL = function(blob) {
    if (blob instanceof Blob) {
      emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', { type: 'blob', size: blob.size, mimeType: blob.type, timestamp: Date.now() })
    }
    return originalCreateObjectURL.call(this, blob)
  }

  const SUSPICIOUS_EXTENSIONS = ['.exe', '.msi', '.bat', '.ps1', '.cmd', '.scr', '.vbs', '.js', '.jar', '.dll']

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLAnchorElement)) return
    if (!target.download && !target.href) return

    try {
      const href = target.href || ''
      const download = target.download || ''

      if (href.startsWith('blob:') || href.startsWith('data:')) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: href.startsWith('blob:') ? 'blob_link' : 'data_url',
          filename: download,
          timestamp: Date.now()
        })
        return
      }

      const filename = download || href.split('/').pop() || ''
      const extension = '.' + filename.split('.').pop().toLowerCase()
      if (SUSPICIOUS_EXTENSIONS.includes(extension)) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: 'suspicious_extension',
          filename,
          extension,
          url: href,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.debug('[ai-hooks] Failed to inspect download click.', error)
    }
  }, true)

  // ===== SUPPLY CHAIN RISK DETECTION =====
  function isExternalResource(url) {
    try {
      const resourceUrl = new URL(url, window.location.origin)
      return resourceUrl.hostname !== window.location.hostname
    } catch {
      return false
    }
  }

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

  function checkSupplyChainRisk(element, resourceType) {
    const url = resourceType === 'script' ? element.src : element.href
    if (!url || !isExternalResource(url)) return

    const hasIntegrity = element.hasAttribute('integrity') && element.integrity
    const hasCrossorigin = element.hasAttribute('crossorigin')
    const isCDN = isKnownCDN(url)

    if (!hasIntegrity) {
      const risks = ['missing_sri']
      if (isCDN) risks.push('cdn_without_sri')
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

  // MutationObserver for dynamic resource loading
  const supplyChainObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue

        if (node.tagName === 'SCRIPT' && node.src) {
          checkSupplyChainRisk(node, 'script')
        }

        if (node.tagName === 'LINK' && node.href && node.rel === 'stylesheet') {
          checkSupplyChainRisk(node, 'stylesheet')
        }
      }
    }
  })

  // Start observing DOM changes for supply chain risk
  if (document.body) {
    supplyChainObserver.observe(document.body, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        supplyChainObserver.observe(document.body, { childList: true, subtree: true })
      }
    })
  }

  // Also observe document.head for scripts added there
  if (document.head) {
    supplyChainObserver.observe(document.head, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.head) {
        supplyChainObserver.observe(document.head, { childList: true, subtree: true })
      }
    })
  }

  // ===== CREDENTIAL THEFT DETECTION =====
  function hasSensitiveFields(form) {
    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card']
    const sensitiveNames = ['password', 'passwd', 'pwd', 'pass', 'secret', 'token', 'api_key', 'apikey', 'credit', 'card', 'cvv', 'ssn', 'otp', 'pin', 'auth', 'credential', '2fa', 'mfa']

    const inputs = form.querySelectorAll('input')
    for (const input of inputs) {
      const type = (input.type || '').toLowerCase()
      const name = (input.name || '').toLowerCase()
      const id = (input.id || '').toLowerCase()
      const autocomplete = (input.autocomplete || '').toLowerCase()

      if (sensitiveTypes.includes(type)) return { hasSensitive: true, fieldType: type }

      for (const pattern of sensitiveNames) {
        if (name.includes(pattern) || id.includes(pattern)) {
          return { hasSensitive: true, fieldType: pattern }
        }
      }

      if (autocomplete.includes('password') || autocomplete.includes('cc-')) {
        return { hasSensitive: true, fieldType: autocomplete }
      }
    }

    return { hasSensitive: false, fieldType: null }
  }

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

      if (hasSensitive) {
        const risks = []
        if (!isSecure) risks.push('insecure_protocol')
        if (isCrossOrigin) risks.push('cross_origin')

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
      console.debug('[ai-hooks] Failed to inspect form action.', error)
    }
  }, true)

  // AI Prompt Capture + Security Detection initialized
})()
