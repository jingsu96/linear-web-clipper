/**
 * Storage utilities for managing extension settings
 */

export interface StorageSettings {
  linearApiKey?: string
  aiProvider?: 'openai' | 'anthropic' | 'gemini' | 'none'
  aiApiKey?: string
  defaultTeamId?: string
  defaultProjectId?: string
  includeMetadata?: boolean
  autoSummarize?: boolean
}

/**
 * Get all settings from storage
 */
export async function getSettings(): Promise<StorageSettings> {
  const result = await chrome.storage.local.get([
    'linearApiKey',
    'aiProvider',
    'aiApiKey',
    'defaultTeamId',
    'defaultProjectId',
    'includeMetadata',
    'autoSummarize',
  ])

  return {
    linearApiKey: result.linearApiKey,
    aiProvider: result.aiProvider || 'none',
    aiApiKey: result.aiApiKey,
    defaultTeamId: result.defaultTeamId,
    defaultProjectId: result.defaultProjectId,
    includeMetadata: result.includeMetadata !== false, // default true
    autoSummarize: result.autoSummarize || false,
  }
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: Partial<StorageSettings>): Promise<void> {
  await chrome.storage.local.set(settings)
}

/**
 * Clear all settings
 */
export async function clearSettings(): Promise<void> {
  await chrome.storage.local.clear()
}

/**
 * Check if Linear API key is configured
 */
export async function hasLinearApiKey(): Promise<boolean> {
  const { linearApiKey } = await chrome.storage.local.get('linearApiKey')
  return !!linearApiKey
}

/**
 * Check if AI is configured
 */
export async function hasAIConfigured(): Promise<boolean> {
  const { aiProvider, aiApiKey } = await chrome.storage.local.get(['aiProvider', 'aiApiKey'])
  return aiProvider !== 'none' && !!aiApiKey
}
