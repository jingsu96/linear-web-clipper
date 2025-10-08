console.log('[Linear Web Clipper] Background service worker initialized')

// Listen for messages from content scripts and sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type)

  if (message.type === 'EXTRACT_CONTENT') {
    handleExtractContent(sender.tab?.id)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true // Keep channel open for async response
  }

  if (message.type === 'CREATE_LINEAR_ISSUE') {
    handleCreateLinearIssue(message.payload)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true
  }

  if (message.type === 'SUMMARIZE_CONTENT') {
    handleSummarizeContent(message.payload)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true
  }

  if (message.type === 'GET_LINEAR_DATA') {
    handleGetLinearData()
      .then(data => {
        console.log('[Background] Sending response:', data)
        sendResponse(data)
      })
      .catch(error => {
        console.error('[Background] Error:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

// Handle content extraction
async function handleExtractContent(tabId: number | undefined) {
  // If no tabId provided, try to get the active tab
  if (!tabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab || !activeTab.id) {
      throw new Error('No active tab found')
    }
    tabId = activeTab.id
  }

  try {
    // First, inject Readability library
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['public/Readability.js'],
      })
    } catch (e) {
      console.warn('[Background] Could not inject Readability, using fallback:', e)
    }

    // Then execute content extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
    })

    return { success: true, data: results[0].result }
  } catch (error) {
    console.error('[Background] Content extraction failed:', error)
    throw error
  }
}

// Function injected into page to extract content
function extractPageContent() {
  try {
    // Get page metadata
    const title = document.title
    const url = window.location.href

    // Use Readability to extract main content
    // @ts-ignore - Readability is imported globally
    const { Readability } = window as any

    let articleElement: HTMLElement

    if (Readability) {
      // Clone document for Readability
      const documentClone = document.cloneNode(true) as Document
      const reader = new Readability(documentClone)
      const article = reader.parse()

      if (article && article.content) {
        console.log('[Content Extractor] Using Readability to extract content')
        // Create a temporary container for the extracted content
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = article.content
        articleElement = tempDiv
      } else {
        console.warn('[Content Extractor] Readability failed, falling back to body')
        articleElement = document.body
      }
    } else {
      // Fallback if Readability is not available
      console.warn('[Content Extractor] Readability not available, using body')
      articleElement = document.body
    }

    // Clone the content to avoid modifying
    const clonedContent = articleElement.cloneNode(true) as HTMLElement

    // Remove unwanted elements
    const selectorsToRemove = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.advertisement',
      '.ad',
      '.social-share',
      '.comments',
      '.comment',
      '.comment-section',
      '.comment-list',
      '.comment-area',
      '.comments-section',
      '#comments',
      '#comment',
      '#disqus_thread',
      '#discourse-comments',
      '[id*="comment" i]',
      '[class*="comment" i]',
      '#references',
      '.references',
      '[id*="reference" i]',
      '[class*="reference" i]',
      '#see-also',
      '#external-links',
      '#further-reading',
      '#bibliography',
      '.mw-references-wrap', // Wikipedia references
      '.reflist', // Wikipedia reference list
    ]

    selectorsToRemove.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove())
    })

    // Find conclusion section and remove everything after it
    const allHeadings = Array.from(clonedContent.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    let conclusionIndex = -1

    // First pass: find the conclusion heading
    for (let i = 0; i < allHeadings.length; i++) {
      const heading = allHeadings[i]
      const text = heading.textContent?.toLowerCase() || ''
      if (
        text.includes('conclusion') ||
        text.includes('summary') ||
        text.includes('in summary') ||
        text.includes('to sum up') ||
        text.includes('in conclusion') ||
        text.includes('final thoughts') ||
        text.includes('wrapping up') ||
        text.includes('takeaway') ||
        text.includes('key points')
      ) {
        conclusionIndex = i
        break
      }
    }

    // If we found a conclusion, find the next same-level heading and remove everything from there
    if (conclusionIndex >= 0) {
      const conclusionHeading = allHeadings[conclusionIndex] as HTMLElement
      const conclusionLevel = parseInt(conclusionHeading.tagName.substring(1))

      // Find the next heading at the same level or higher
      for (let i = conclusionIndex + 1; i < allHeadings.length; i++) {
        const nextHeading = allHeadings[i] as HTMLElement
        const nextLevel = parseInt(nextHeading.tagName.substring(1))

        if (nextLevel <= conclusionLevel) {
          // Remove this heading and everything after it
          let toRemove: Element | null = nextHeading
          while (toRemove) {
            const nextSibling = toRemove.nextSibling as Element | null
            toRemove.remove()
            toRemove = nextSibling
          }
          break
        }
      }
    }

    // Second pass: Remove other unwanted sections
    const remainingHeadings = clonedContent.querySelectorAll('h1, h2, h3, h4, h5, h6')
    remainingHeadings.forEach(heading => {
      const text = heading.textContent?.toLowerCase() || ''

      if (
        text.includes('reference') ||
        text.includes('see also') ||
        text.includes('external link') ||
        text.includes('further reading') ||
        text.includes('bibliography') ||
        text.includes('citation') ||
        text.includes('notes') ||
        text.includes('comment') ||
        text.includes('discussion') ||
        text.includes('leave a reply') ||
        text.includes('post a comment') ||
        text.includes('add comment')
      ) {
        // Remove the heading and all content until the next heading or end
        let current = heading.nextElementSibling
        heading.remove()
        while (current && !current.matches('h1, h2, h3, h4, h5, h6')) {
          const next = current.nextElementSibling
          current.remove()
          current = next
        }
      }
    })

    // Additional comment detection: Look for elements with "comment" in their text content
    // Only remove if it looks like a comment section (multiple comment elements or large blocks)
    const allElements = clonedContent.querySelectorAll('*')
    allElements.forEach(element => {
      const text = element.textContent?.toLowerCase() || ''
      const id = element.id?.toLowerCase() || ''
      const className = element.className?.toString().toLowerCase() || ''

      // Check if element or its attributes contain comment-related keywords
      const hasCommentKeyword =
        id.includes('comment') ||
        className.includes('comment') ||
        (text.includes('comment') && text.length < 100) // Short text with "comment"

      // Check if it's a comment form or container
      const isCommentContainer =
        element.tagName === 'FORM' ||
        element.querySelector('textarea[placeholder*="comment" i]') !== null ||
        element.querySelector('input[placeholder*="comment" i]') !== null

      if (hasCommentKeyword || isCommentContainer) {
        element.remove()
      }
    })

    // Get the HTML content
    const htmlContent = clonedContent.innerHTML

    // Get text content as fallback
    const textContent = clonedContent.innerText

    // Get meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''

    return {
      title,
      url,
      htmlContent,
      textContent,
      metaDescription,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Content extraction error:', error)
    return {
      title: document.title,
      url: window.location.href,
      htmlContent: '',
      textContent: document.body.innerText,
      metaDescription: '',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Handle Linear issue creation
async function handleCreateLinearIssue(payload: {
  teamId: string
  projectId?: string
  title: string
  description: string
  apiKey: string
}) {
  const { teamId, projectId, title, description, apiKey } = payload

  console.log('[Background] Creating issue with:', { teamId, projectId, title, descriptionLength: description.length })

  try {
    // Truncate description if too long (Linear limit is 250,000 characters)
    const MAX_DESCRIPTION_LENGTH = 250000
    let finalDescription = description

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      console.warn(`[Background] Description too long (${description.length} chars), truncating to ${MAX_DESCRIPTION_LENGTH}`)
      finalDescription = description.slice(0, MAX_DESCRIPTION_LENGTH - 100) + '\n\n---\n\n*[Content truncated due to length]*'
    }

    // Build the input object conditionally
    const input: any = {
      teamId,
      title,
      description: finalDescription,
    }

    // Only add projectId if it's provided
    if (projectId) {
      input.projectId = projectId
    }

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({
        query: `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
              }
            }
          }
        `,
        variables: {
          input,
        },
      }),
    })

    const result = await response.json()

    console.log('[Background] Issue creation response:', result)

    if (result.errors) {
      console.error('[Background] GraphQL errors:', result.errors)
      const errorMsg = result.errors[0].extensions?.validationErrors
        ? JSON.stringify(result.errors[0].extensions.validationErrors)
        : result.errors[0].message
      throw new Error(errorMsg)
    }

    return { success: true, data: result.data.issueCreate.issue }
  } catch (error) {
    console.error('[Background] Linear issue creation failed:', error)
    throw error
  }
}

// Handle content summarization
async function handleSummarizeContent(payload: {
  content: string
  apiKey: string
  provider: 'openai' | 'anthropic'
}) {
  const { content, apiKey, provider } = payload

  try {
    if (provider === 'openai') {
      return await summarizeWithOpenAI(content, apiKey)
    } else if (provider === 'anthropic') {
      return await summarizeWithAnthropic(content, apiKey)
    }
    throw new Error('Unsupported AI provider')
  } catch (error) {
    console.error('[Background] Summarization failed:', error)
    throw error
  }
}

async function summarizeWithOpenAI(content: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes web page content concisely. Focus on key points and main ideas.',
        },
        {
          role: 'user',
          content: `Please summarize the following content:\n\n${content.slice(0, 6000)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  })

  const result = await response.json()

  if (result.error) {
    throw new Error(result.error.message)
  }

  return {
    success: true,
    summary: result.choices[0].message.content,
  }
}

async function summarizeWithAnthropic(content: string, apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Please summarize the following web page content concisely. Focus on key points and main ideas:\n\n${content.slice(0, 6000)}`,
        },
      ],
    }),
  })

  const result = await response.json()

  if (result.error) {
    throw new Error(result.error.message)
  }

  return {
    success: true,
    summary: result.content[0].text,
  }
}

// Handle fetching Linear data (teams, projects)
async function handleGetLinearData() {
  try {
    const { linearApiKey } = await chrome.storage.local.get('linearApiKey')

    if (!linearApiKey) {
      throw new Error('Linear API key not configured')
    }

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': linearApiKey,
      },
      body: JSON.stringify({
        query: `
          query GetTeamsAndProjects {
            teams {
              nodes {
                id
                name
                key
                projects {
                  nodes {
                    id
                    name
                    state
                  }
                }
              }
            }
          }
        `,
      }),
    })

    const result = await response.json()

    if (result.errors) {
      throw new Error(result.errors[0].message)
    }

    // Transform the nested structure to flat lists
    const teams = result.data.teams.nodes
    console.log('[Background] Raw teams data:', teams)

    const projects = teams.flatMap((team: any) =>
      team.projects.nodes.map((project: any) => ({
        ...project,
        team: {
          id: team.id,
          name: team.name,
        },
      }))
    )

    const teamsData = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      key: team.key,
    }))

    const transformedData = {
      success: true,
      data: {
        teams: teamsData,
        projects,
      },
    }

    console.log('[Background] Transformed data:', transformedData)

    return transformedData
  } catch (error) {
    console.error('[Background] Failed to fetch Linear data:', error)
    throw error
  }
}

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})
