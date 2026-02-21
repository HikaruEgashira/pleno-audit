;(function() {
  'use strict'

  if (window.__AI_PROMPT_CAPTURE_INITIALIZED__) return
  window.__AI_PROMPT_CAPTURE_INITIALIZED__ = true

  const MAX_CONTENT_SIZE = 50000
  const TRUNCATE_SIZE = 10000

  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send

  const sharedHookUtils = window.__PLENO_HOOKS_SHARED__
  const emitSecurityEvent = sharedHookUtils?.emitSecurityEvent
    ?? ((eventName, data) => window.dispatchEvent(new CustomEvent(eventName, { detail: data })))

  function isAIRequestBody(body) {
    if (!body) return false
    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      if (!obj || typeof obj !== 'object') return false
      if (isMessagesArray(obj.messages)) return true
      if (typeof obj.prompt === 'string' && typeof obj.model === 'string') return true
      if (isGeminiContents(obj.contents)) return true
      if (isChatGPTConversation(obj)) return true
      return false
    } catch {
      return false
    }
  }

  function isChatGPTConversation(obj) {
    if (typeof obj.action === 'string' &&
        ['next', 'variant', 'continue'].includes(obj.action) &&
        typeof obj.conversation_id === 'string') return true
    if (typeof obj.action === 'string' &&
        obj.action === 'next' &&
        Array.isArray(obj.messages)) return true
    return false
  }

  function isMessagesArray(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return false
    return messages.some(m =>
      m && typeof m === 'object' && (
        (typeof m.role === 'string' && ('content' in m || 'parts' in m)) ||
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

      if (isMessagesArray(obj.messages)) {
        return {
          messages: obj.messages.map(m => ({
            role: m.role || m.author?.role || 'user',
            content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
          })),
          contentSize, truncated, model: obj.model,
        }
      }
      if (typeof obj.prompt === 'string') {
        return { text: truncateString(obj.prompt, TRUNCATE_SIZE), contentSize, truncated, model: obj.model }
      }
      if (isGeminiContents(obj.contents)) {
        return {
          messages: obj.contents.map(c => ({
            role: c.role || 'user',
            content: truncateString(c.parts.map(p => p.text || '').join(''), TRUNCATE_SIZE),
          })),
          contentSize, truncated, model: obj.model,
        }
      }
      if (isChatGPTConversation(obj)) {
        return {
          chatgptAction: obj.action, conversationId: obj.conversation_id,
          parentMessageId: obj.parent_message_id, contentSize, truncated, model: obj.model,
        }
      }
      return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize, truncated }
    } catch {
      const bodyStr = String(body)
      return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize: bodyStr.length, truncated: bodyStr.length > TRUNCATE_SIZE }
    }
  }

  function extractMessageContent(message) {
    if (typeof message.content === 'string') return message.content
    if (Array.isArray(message.content)) {
      return message.content.map(c => {
        if (typeof c === 'string') return c
        if (c.type === 'text' && typeof c.text === 'string') return c.text
        return ''
      }).join('')
    }
    if (message.content && Array.isArray(message.content.parts)) {
      return message.content.parts.map(p => typeof p === 'string' ? p : (p.text || '')).join('')
    }
    if (typeof message.text === 'string') return message.text
    return ''
  }

  function extractResponse(text, isStreaming) {
    const contentSize = text.length
    const truncated = contentSize > TRUNCATE_SIZE
    const result = { contentSize, truncated, isStreaming }

    try {
      if (isStreaming || text.includes('data: ')) {
        result.text = extractStreamingContent(text)
        return result
      }
      const obj = JSON.parse(text)
      if (obj.choices?.[0]?.message?.content) {
        result.text = truncateString(obj.choices[0].message.content, TRUNCATE_SIZE)
      } else if (obj.choices?.[0]?.text) {
        result.text = truncateString(obj.choices[0].text, TRUNCATE_SIZE)
      } else if (obj.content?.[0]?.text) {
        result.text = truncateString(obj.content[0].text, TRUNCATE_SIZE)
      } else if (obj.candidates?.[0]?.content?.parts?.[0]?.text) {
        result.text = truncateString(obj.candidates[0].content.parts[0].text, TRUNCATE_SIZE)
      }
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
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
      try {
        const data = JSON.parse(line.slice(6))
        const delta = data.choices?.[0]?.delta?.content
          || data.delta?.text
          || data.candidates?.[0]?.content?.parts?.[0]?.text
        if (delta) chunks.push(delta)
      } catch {}
    }
    return truncateString(chunks.join(''), TRUNCATE_SIZE)
  }

  function truncateString(str, maxLength) {
    return str.length <= maxLength ? str : str.substring(0, maxLength)
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    if (!body || method === 'GET' || !isAIRequestBody(body)) {
      return originalFetch.apply(this, arguments)
    }

    const startTime = Date.now()
    const promptContent = extractPrompt(body)
    const captureData = {
      id: crypto.randomUUID(), timestamp: startTime, pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: method.toUpperCase(), prompt: promptContent, model: promptContent?.model,
    }

    try {
      const response = await originalFetch.apply(this, arguments)
      const clonedResponse = response.clone()
      const contentType = response.headers.get('content-type') || ''
      const isStreaming = contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')

      clonedResponse.text().then(text => {
        if (text.length > MAX_CONTENT_SIZE) {
          emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
          return
        }
        captureData.response = extractResponse(text, isStreaming)
        captureData.responseTimestamp = Date.now()
        captureData.response.latencyMs = Date.now() - startTime
        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      }).catch(() => emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData))

      return response
    } catch (error) {
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

    if (!body || method === 'GET' || !isAIRequestBody(body)) {
      return originalXHRSend.call(this, body)
    }

    const startTime = Date.now()
    const promptContent = extractPrompt(body)
    const captureData = {
      id: crypto.randomUUID(), timestamp: startTime, pageUrl: window.location.href,
      apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
      method: (method || 'POST').toUpperCase(), prompt: promptContent, model: promptContent?.model,
    }

    const xhr = this
    const originalOnReadyStateChange = xhr.onreadystatechange
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        try {
          const responseText = xhr.responseText
          if (responseText && responseText.length <= MAX_CONTENT_SIZE) {
            const contentType = xhr.getResponseHeader('content-type') || ''
            captureData.response = extractResponse(responseText, contentType.includes('text/event-stream'))
            captureData.responseTimestamp = Date.now()
            captureData.response.latencyMs = Date.now() - startTime
          }
        } catch {}
        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
      }
      if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments)
    }

    return originalXHRSend.call(this, body)
  }
})()
