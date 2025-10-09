/**
 * Message types for communication between different parts of the extension
 */

export type MessageType =
  | 'EXTRACT_CONTENT'
  | 'CREATE_LINEAR_ISSUE'
  | 'SUMMARIZE_CONTENT'
  | 'GET_LINEAR_DATA'
  | 'REFORMAT_TRANSCRIPT'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Send a message to the background service worker
 */
export function sendMessage<T = unknown, R = unknown>(
  message: Message<T>
): Promise<MessageResponse<R>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<R>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (response?.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Extract content from the current page
 */
export async function extractContent() {
  return sendMessage({
    type: 'EXTRACT_CONTENT',
  })
}

/**
 * Create a Linear issue
 */
export async function createLinearIssue(payload: {
  teamId: string
  projectId?: string
  title: string
  description: string
  summary?: string
  apiKey: string
}) {
  return sendMessage({
    type: 'CREATE_LINEAR_ISSUE',
    payload,
  })
}

/**
 * Summarize content using AI
 */
export async function summarizeContent(payload: {
  content: string
  apiKey: string
  provider: 'openai' | 'anthropic' | 'gemini'
}) {
  return sendMessage({
    type: 'SUMMARIZE_CONTENT',
    payload,
  })
}

/**
 * Get Linear teams and projects
 */
export async function getLinearData() {
  return sendMessage({
    type: 'GET_LINEAR_DATA',
  })
}

/**
 * Reformat transcript to article format using AI
 */
export async function reformatTranscript(payload: {
  content: string
  apiKey: string
  provider: 'openai' | 'anthropic' | 'gemini'
}) {
  return sendMessage({
    type: 'REFORMAT_TRANSCRIPT',
    payload,
  })
}
