import { useState, useEffect } from 'react'
import { getSettings, hasLinearApiKey } from '@/lib/storage'
import { extractContent, createLinearIssue, summarizeContent, getLinearData } from '@/lib/messages'
import { formatAsMarkdown, generatePreview, estimateReadingTime } from '@/lib/content-extractor'
import type { ExtractedContent } from '@/lib/content-extractor'
import type { StorageSettings } from '@/lib/storage'
import './App.css'

interface LinearTeam {
  id: string
  name: string
  key: string
}

interface LinearProject {
  id: string
  name: string
  state: string
  team: {
    id: string
    name: string
  }
}

export default function App() {
  const [settings, setSettings] = useState<StorageSettings>({})
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<ExtractedContent | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [summary, setSummary] = useState('')
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (content && settings) {
      const md = formatAsMarkdown(content, settings.includeMetadata)
      setMarkdown(md)
      setIssueTitle(content.title)

      // Auto-summarize if enabled
      if (settings.autoSummarize && settings.aiProvider && settings.aiProvider !== 'none') {
        handleSummarize()
      }
    }
  }, [content, settings])

  async function initialize() {
    setLoading(true)
    setError('')

    try {
      const stored = await getSettings()
      setSettings(stored)
      const configured = await hasLinearApiKey()
      setIsConfigured(configured)

      if (!configured) {
        setError('Please configure Linear API key in extension settings')
        setLoading(false)
        return
      }

      // Fetch Linear data
      const linearData = await getLinearData()
      console.log('[Sidepanel] Linear data received:', linearData)

      if (linearData.success && linearData.data) {
        const data = linearData.data as { teams: LinearTeam[], projects: LinearProject[] }
        console.log('[Sidepanel] Teams:', data.teams)
        console.log('[Sidepanel] Projects:', data.projects)

        setTeams(data.teams)
        setProjects(data.projects)

        // Set default team if configured
        if (stored.defaultTeamId) {
          setSelectedTeam(stored.defaultTeamId)
        }

        // Set default project if configured
        if (stored.defaultProjectId) {
          setSelectedProject(stored.defaultProjectId)
        }
      } else {
        console.error('[Sidepanel] Failed to fetch Linear data:', linearData)
        setError('Failed to load Linear teams and projects')
      }

      // Extract page content
      try {
        const result = await extractContent()
        if (result.success && result.data) {
          setContent(result.data as ExtractedContent)
        } else {
          setError('Failed to extract page content')
        }
      } catch (extractError) {
        console.error('Content extraction error:', extractError)
        setError(
          extractError instanceof Error
            ? extractError.message
            : 'Cannot extract content from this page. Try opening the sidepanel on a regular web page.'
        )
      }
    } catch (err) {
      console.error('Initialization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    } finally {
      setLoading(false)
    }
  }

  async function handleSummarize() {
    if (!settings.aiProvider || settings.aiProvider === 'none' || !settings.aiApiKey) {
      setError('AI provider not configured. Please configure in settings.')
      return
    }

    if (!markdown) {
      setError('No content to summarize')
      return
    }

    setSummarizing(true)
    setError('')

    try {
      const result = await summarizeContent({
        content: markdown,
        apiKey: settings.aiApiKey,
        provider: settings.aiProvider,
      })

      if (result.success && result.data) {
        setSummary((result.data as { summary: string }).summary)
        setStatus('Summary generated successfully!')
        setTimeout(() => setStatus(''), 3000)
      } else {
        setError('Failed to generate summary')
      }
    } catch (err) {
      console.error('Summarization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to summarize content')
    } finally {
      setSummarizing(false)
    }
  }

  async function handleCreateIssue() {
    if (!selectedTeam) {
      setError('Please select a team')
      return
    }

    if (!issueTitle.trim()) {
      setError('Please enter an issue title')
      return
    }

    if (!settings.linearApiKey) {
      setError('Linear API key not configured')
      return
    }

    setCreating(true)
    setError('')
    setStatus('Creating Linear issue...')

    try {
      const description = summary
        ? `${summary}\n\n---\n\n${markdown}`
        : markdown

      const result = await createLinearIssue({
        teamId: selectedTeam,
        projectId: selectedProject || undefined,
        title: issueTitle,
        description,
        apiKey: settings.linearApiKey,
      })

      if (result.success && result.data) {
        const issue = result.data as { identifier: string; url: string }
        setStatus(`✓ Created ${issue.identifier}`)

        // Open the issue in a new tab
        setTimeout(() => {
          window.open(issue.url, '_blank')
        }, 500)
      } else {
        setError('Failed to create Linear issue')
      }
    } catch (err) {
      console.error('Issue creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create issue')
      setStatus('')
    } finally {
      setCreating(false)
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
  }

  const filteredProjects = projects.filter(p =>
    !selectedTeam || p.team.id === selectedTeam
  )

  const readingTime = content ? estimateReadingTime(content.textContent) : 0
  const preview = markdown ? generatePreview(markdown, 150) : ''

  if (!isConfigured) {
    return (
      <div className="sidepanel-container">
        <div className="sidepanel-header">
          <h1>Linear Web Clipper</h1>
        </div>
        <div className="sidepanel-content">
          <div className="empty-state">
            <h2>Not Configured</h2>
            <p>Please configure your Linear API key to start clipping pages.</p>
            <button type="button" className="primary-button" onClick={openSettings}>
              Open Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="sidepanel-container">
        <div className="sidepanel-header">
          <h1>Linear Web Clipper</h1>
        </div>
        <div className="sidepanel-content">
          <div className="loading-state">
            <div className="spinner" />
            <p>Extracting page content...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sidepanel-container">
      <div className="sidepanel-header">
        <h1>Linear Web Clipper</h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => initialize()}
          disabled={loading}
          aria-label="Refresh content"
          title="Refresh content"
        >
          ↻
        </button>
      </div>

      <div className="sidepanel-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {status && (
          <div className="alert alert-success">
            {status}
          </div>
        )}

        {content && (
          <>
            <section className="content-preview">
              <h2>{content.title}</h2>
              <div className="content-meta">
                <span>{readingTime} min read</span>
                <span>•</span>
                <a href={content.url} target="_blank" rel="noreferrer">
                  Open page
                </a>
              </div>
              {preview && (
                <p className="preview-text">{preview}</p>
              )}
            </section>

            {summary && (
              <section className="summary-section">
                <h3>Summary</h3>
                <div className="summary-content">
                  {summary}
                </div>
              </section>
            )}

            {settings.aiProvider && settings.aiProvider !== 'none' && !summary && (
              <section className="actions-section">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSummarize}
                  disabled={summarizing}
                >
                  {summarizing ? 'Summarizing...' : 'Generate Summary'}
                </button>
              </section>
            )}

            <section className="linear-section">
              <h3>Create Linear Issue</h3>

              <div className="form-group">
                <label htmlFor="issueTitle">
                  Title <span className="required">*</span>
                </label>
                <input
                  id="issueTitle"
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Enter issue title…"
                />
              </div>

              <div className="form-group">
                <label htmlFor="team">
                  Team <span className="required">*</span>
                </label>
                <select
                  id="team"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="">Select a team…</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.key})
                    </option>
                  ))}
                </select>
              </div>

              {filteredProjects.length > 0 && (
                <div className="form-group">
                  <label htmlFor="project">Project (Optional)</label>
                  <select
                    id="project"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    disabled={!selectedTeam}
                  >
                    <option value="">No project</option>
                    {filteredProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="primary-button full-width"
                onClick={handleCreateIssue}
                disabled={creating || !selectedTeam || !issueTitle.trim()}
              >
                {creating ? 'Creating...' : 'Create Issue'}
              </button>
            </section>

            <section className="markdown-section">
              <details>
                <summary>Preview Markdown ({markdown.length} characters)</summary>
                <pre className="markdown-preview">{markdown}</pre>
              </details>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
