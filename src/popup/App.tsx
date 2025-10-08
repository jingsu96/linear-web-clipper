import { useState, useEffect } from 'react'
import { getSettings, saveSettings, hasLinearApiKey } from '@/lib/storage'
import type { StorageSettings } from '@/lib/storage'
import './App.css'

export default function App() {
  const [settings, setSettings] = useState<StorageSettings>({})
  const [isConfigured, setIsConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const stored = await getSettings()
    setSettings(stored)
    const configured = await hasLinearApiKey()
    setIsConfigured(configured)
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')

    try {
      await saveSettings(settings)
      setMessage('Settings saved successfully!')
      setIsConfigured(!!settings.linearApiKey)

      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`)
    } finally {
      setSaving(false)
    }
  }

  async function openSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
      window.close()
    }
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Linear Web Clipper</h1>
      </div>

      {isConfigured ? (
        <div className="popup-content">
          <p className="success-message">✓ Extension configured</p>
          <button
            type="button"
            className="primary-button"
            onClick={openSidePanel}
          >
            Open Clipper
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsConfigured(false)}
          >
            Settings
          </button>
        </div>
      ) : (
        <div className="popup-content">
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="linearApiKey">
                Linear API Key <span className="required">*</span>
              </label>
              <input
                id="linearApiKey"
                type="password"
                placeholder="lin_api_xxxxxxxxxxxxxxxxxxxx"
                value={settings.linearApiKey || ''}
                onChange={(e) => setSettings({ ...settings, linearApiKey: e.target.value.trim() })}
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Get your API key from{' '}
                <a href="https://linear.app/settings/api" target="_blank" rel="noreferrer">
                  Linear Settings
                </a>
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="aiProvider">AI Summarization (Optional)</label>
              <select
                id="aiProvider"
                value={settings.aiProvider || 'none'}
                onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as StorageSettings['aiProvider'] })}
              >
                <option value="none">None</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            {settings.aiProvider && settings.aiProvider !== 'none' && (
              <div className="form-group">
                <label htmlFor="aiApiKey">
                  {settings.aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
                </label>
                <input
                  id="aiApiKey"
                  type="password"
                  placeholder={settings.aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  value={settings.aiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeMetadata !== false}
                  onChange={(e) => setSettings({ ...settings, includeMetadata: e.target.checked })}
                />
                Include page metadata in clips
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.autoSummarize || false}
                  onChange={(e) => setSettings({ ...settings, autoSummarize: e.target.checked })}
                  disabled={!settings.aiProvider || settings.aiProvider === 'none'}
                />
                Auto-summarize on clip
              </label>
            </div>

            {message && (
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving || !settings.linearApiKey}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
