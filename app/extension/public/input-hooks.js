/**
 * Input Capture Script (Main World)
 * すべてのPOSTリクエストをキャプチャし、AI検知シグネチャがあればフラグを付与
 */

;(function() {
  'use strict'

  // Prevent double initialization
  if (window.__INPUT_CAPTURE_INITIALIZED__) return
  window.__INPUT_CAPTURE_INITIALIZED__ = true

  // Configuration
  const MAX_CONTENT_SIZE = 50000  // 50KB max capture
  const TRUNCATE_SIZE = 10000     // Truncate after 10KB

  // Save original APIs
  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send

  // ============================================================================
  // AI Detection（AIリクエスト検出）
  // ============================================================================

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

  // ============================================================================
  // Content Extraction（コンテンツ抽出）
  // ============================================================================

  function extractContent(body, isAI) {
    if (!body) return null

    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      const contentSize = bodyStr.length
      const truncated = contentSize > TRUNCATE_SIZE

      // AIリクエストの場合は詳細抽出
      if (isAI) {
        // Chat Completion format (including ChatGPT internal format)
        if (isMessagesArray(obj.messages)) {
          return {
            messages: obj.messages.map(m => ({
              role: m.role || m.author?.role || 'user',
              content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
            })),
            contentSize,
            truncated,
          }
        }

        // Completion format
        if (typeof obj.prompt === 'string') {
          return {
            text: truncateString(obj.prompt, TRUNCATE_SIZE),
            contentSize,
            truncated,
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
          }
        }

        // ChatGPT conversation format (action-based)
        if (isChatGPTConversation(obj)) {
          return {
            rawBody: truncateString(bodyStr, TRUNCATE_SIZE),
            contentSize,
            truncated,
          }
        }
      }

      // 非AIまたはフォールバック: 生のボディを保存
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

  // ============================================================================
  // Event Dispatch（イベント送信）
  // ============================================================================

  function sendInputCapture(data) {
    window.dispatchEvent(
      new CustomEvent('__INPUT_CAPTURED__', { detail: data })
    )
    // 後方互換: AIの場合は旧イベントも発火
    if (data.isAI) {
      window.dispatchEvent(
        new CustomEvent('__AI_PROMPT_CAPTURED__', { detail: data })
      )
    }
  }

  // ============================================================================
  // Fetch Hook
  // ============================================================================

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    // Only capture POST/PUT requests with body
    if (!body || method.toUpperCase() === 'GET') {
      return originalFetch.apply(this, arguments)
    }

    const startTime = Date.now()
    const isAI = isAIRequestBody(body)
    const contentData = extractContent(body, isAI)

    const captureData = {
      id: generateId(),
      timestamp: startTime,
      pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: method.toUpperCase(),
      isAI: isAI,
      content: contentData,
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
          sendInputCapture(captureData)
          return
        }

        captureData.response = extractResponse(text, isStreaming)
        captureData.responseTimestamp = Date.now()
        captureData.response.latencyMs = Date.now() - startTime

        sendInputCapture(captureData)
      }).catch(() => {
        // Send without response on error
        sendInputCapture(captureData)
      })

      return response
    } catch (error) {
      // Send capture even on error
      sendInputCapture(captureData)
      throw error
    }
  }

  // ============================================================================
  // XHR Hook
  // ============================================================================

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__inputCaptureUrl = url
    this.__inputCaptureMethod = method
    return originalXHROpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function(body) {
    const url = this.__inputCaptureUrl
    const method = this.__inputCaptureMethod

    // Only capture POST/PUT requests with body
    if (!body || (method || '').toUpperCase() === 'GET') {
      return originalXHRSend.call(this, body)
    }

    const startTime = Date.now()
    const isAI = isAIRequestBody(body)
    const contentData = extractContent(body, isAI)

    const captureData = {
      id: generateId(),
      timestamp: startTime,
      pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: (method || 'POST').toUpperCase(),
      isAI: isAI,
      content: contentData,
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
        } catch {
          // ignore
        }

        sendInputCapture(captureData)
      }

      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments)
      }
    }

    return originalXHRSend.call(this, body)
  }

  console.log('[Input Capture] Initialized')
})()
