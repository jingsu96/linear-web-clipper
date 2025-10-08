import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

export interface ExtractedContent {
  title: string
  url: string
  htmlContent: string
  textContent: string
  metaDescription: string
  timestamp: string
  error?: string
}

// Configure Turndown for markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
  // Keep images as markdown links
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
})

// Use GitHub Flavored Markdown plugin for tables and better formatting
turndownService.use(gfm)

// Add custom rules for better markdown conversion
turndownService.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
})

turndownService.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => `==${content}==`,
})

// Enhanced image handling with alt text and captions
turndownService.addRule('images', {
  filter: 'img',
  replacement: (_content, node) => {
    const alt = (node as HTMLImageElement).alt || 'image'
    const src = (node as HTMLImageElement).src || ''
    const title = (node as HTMLImageElement).title

    if (!src) return ''

    // Check if there's a caption
    const figure = node.parentElement
    let caption = ''
    if (figure && figure.tagName === 'FIGURE') {
      const figcaption = figure.querySelector('figcaption')
      if (figcaption) {
        caption = figcaption.textContent?.trim() || ''
      }
    }

    const titlePart = title ? ` "${title}"` : ''
    const imageMarkdown = `![${alt}](${src}${titlePart})`

    return caption ? `${imageMarkdown}\n*${caption}*` : imageMarkdown
  },
})

// Enhanced list handling to preserve nested lists
turndownService.addRule('listItems', {
  filter: 'li',
  replacement: (content, node, options) => {
    content = content
      .replace(/^\n+/, '') // remove leading newlines
      .replace(/\n+$/, '\n') // replace trailing newlines with just one
      .replace(/\n/gm, '\n    ') // indent

    let prefix = options.bulletListMarker + ' '
    const parent = node.parentNode as HTMLElement

    if (parent && parent.nodeName === 'OL') {
      const start = parent.getAttribute('start')
      const index = Array.prototype.indexOf.call(parent.children, node)
      prefix = (start ? Number(start) + index : index + 1) + '. '
    }

    return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
  },
})

// Enhanced code block handling with language detection
turndownService.addRule('fencedCodeBlock', {
  filter: (node, options) => {
    return !!(
      options.codeBlockStyle === 'fenced' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },
  replacement: (_content, node, _options) => {
    const code = node.firstChild as HTMLElement
    const className = code.getAttribute('class') || ''
    const language = extractLanguageFromClass(className)
    const codeContent = code.textContent || ''

    return '\n\n```' + language + '\n' + codeContent + '\n```\n\n'
  },
})

// Inline code - convert to code blocks instead of inline backticks
turndownService.addRule('inlineCode', {
  filter: (node) => {
    const isCodeChild = node.parentNode?.nodeName === 'PRE'
    return !!(node.nodeName === 'CODE' && !isCodeChild)
  },
  replacement: (_content, node) => {
    const text = (node as HTMLElement).textContent || ''
    const className = (node as HTMLElement).getAttribute('class') || ''
    const language = extractLanguageFromClass(className)

    // Use code block for all code elements
    return '\n\n```' + language + '\n' + text + '\n```\n\n'
  },
})

// Enhanced embed handling for Linear-compatible embeds
turndownService.addRule('embeds', {
  filter: (node) => {
    return !!(node.nodeName === 'IFRAME' || node.nodeName === 'EMBED')
  },
  replacement: (_content, node) => {
    const src = (node as HTMLElement).getAttribute('src') || ''

    if (!src) return ''

    // Check if it's a supported embed platform
    const embedUrl = extractEmbedUrl(src)

    if (embedUrl) {
      return '\n\n' + embedUrl + '\n\n'
    }

    // Fallback: just link to the iframe source
    return `\n\n[Embedded content](${src})\n\n`
  },
})

// Remove unwanted elements (but not iframes, we handle them above)
turndownService.remove(['script', 'style', 'noscript'])

/**
 * Extract and normalize embed URLs for Linear compatibility
 * Linear supports embeds from: YouTube, Vimeo, Figma, Loom, Twitter, and more
 */
function extractEmbedUrl(iframeSrc: string): string | null {
  try {
    const url = new URL(iframeSrc)

    // YouTube embeds
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      // Extract video ID from various YouTube URL formats
      let videoId = ''

      if (url.hostname.includes('youtube.com')) {
        if (url.pathname.includes('/embed/')) {
          videoId = url.pathname.split('/embed/')[1]?.split('?')[0] || ''
        } else if (url.searchParams.has('v')) {
          videoId = url.searchParams.get('v') || ''
        }
      } else if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1).split('?')[0]
      }

      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`
      }
    }

    // Vimeo embeds
    if (url.hostname.includes('vimeo.com')) {
      const videoId = url.pathname.split('/').pop()
      if (videoId) {
        return `https://vimeo.com/${videoId}`
      }
    }

    // Figma embeds
    if (url.hostname.includes('figma.com')) {
      // Return the full Figma URL
      return iframeSrc.split('?')[0]
    }

    // Loom embeds
    if (url.hostname.includes('loom.com')) {
      const pathParts = url.pathname.split('/')
      const videoId = pathParts[pathParts.length - 1]
      if (videoId) {
        return `https://www.loom.com/share/${videoId}`
      }
    }

    // Twitter/X embeds
    if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
      return iframeSrc
    }

    // CodePen embeds
    if (url.hostname.includes('codepen.io')) {
      return iframeSrc.replace('/embed/', '/pen/')
    }

    // JSFiddle embeds
    if (url.hostname.includes('jsfiddle.net')) {
      return iframeSrc.split('/embedded/')[0] || iframeSrc
    }

    // CodeSandbox embeds
    if (url.hostname.includes('codesandbox.io')) {
      const sandboxId = url.pathname.split('/').find(part => part && part !== 'embed' && part !== 's')
      if (sandboxId) {
        return `https://codesandbox.io/s/${sandboxId}`
      }
    }

    // Google Drive embeds (docs, sheets, slides)
    if (url.hostname.includes('docs.google.com') || url.hostname.includes('drive.google.com')) {
      return iframeSrc.split('?')[0]
    }

    // Spotify embeds
    if (url.hostname.includes('spotify.com')) {
      return iframeSrc.replace('/embed/', '/')
    }

    // SoundCloud embeds
    if (url.hostname.includes('soundcloud.com')) {
      const trackUrl = url.searchParams.get('url')
      if (trackUrl) {
        return trackUrl
      }
    }

    // GitHub Gists
    if (url.hostname.includes('gist.github.com')) {
      return iframeSrc.split('.js')[0] || iframeSrc
    }

    // For other embeds, return null to fall back to link
    return null
  } catch (e) {
    console.error('Failed to parse embed URL:', e)
    return null
  }
}

/**
 * Extract programming language from class name
 */
function extractLanguageFromClass(className: string): string {
  // Common patterns:
  // - language-javascript, language-js
  // - lang-python, lang-py
  // - javascript, python (direct class name)
  // - highlight-source-ruby
  // - brush: js (SyntaxHighlighter)

  if (!className) return ''

  // Try language- prefix
  const langMatch = className.match(/language-(\w+)/)
  if (langMatch) return langMatch[1]

  // Try lang- prefix
  const langMatch2 = className.match(/lang-(\w+)/)
  if (langMatch2) return langMatch2[1]

  // Try highlight-source- prefix (GitHub style)
  const sourceMatch = className.match(/highlight-source-(\w+)/)
  if (sourceMatch) return sourceMatch[1]

  // Try brush: prefix (SyntaxHighlighter)
  const brushMatch = className.match(/brush:\s*(\w+)/)
  if (brushMatch) return brushMatch[1]

  // Check if class name itself is a language
  const commonLanguages = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java',
    'cpp', 'c', 'csharp', 'ruby', 'go', 'rust', 'php', 'swift',
    'kotlin', 'scala', 'bash', 'shell', 'sh', 'sql', 'html', 'css',
    'json', 'xml', 'yaml', 'markdown', 'md',
  ]

  const classes = className.toLowerCase().split(/\s+/)
  for (const cls of classes) {
    if (commonLanguages.includes(cls)) {
      return cls
    }
  }

  return ''
}

/**
 * Convert HTML content to clean markdown
 */
export function htmlToMarkdown(html: string): string {
  try {
    const markdown = turndownService.turndown(html)
    return cleanMarkdown(markdown)
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error)
    return html
  }
}

/**
 * Clean up markdown output
 */
function cleanMarkdown(markdown: string): string {
  return markdown
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up list formatting
    .replace(/^[\s]*[-*]\s+$/gm, '')
    // Trim each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim()
}

/**
 * Format extracted content as markdown with metadata
 */
export function formatAsMarkdown(content: ExtractedContent, includeMetadata = true): string {
  const parts: string[] = []

  if (includeMetadata) {
    parts.push(`# ${content.title}`)
    parts.push('')
    parts.push(`**Source:** ${content.url}`)
    parts.push(`**Clipped:** ${new Date(content.timestamp).toLocaleString()}`)
    parts.push('')

    if (content.metaDescription) {
      parts.push(`> ${content.metaDescription}`)
      parts.push('')
    }

    parts.push('---')
    parts.push('')
  }

  // Convert HTML to markdown
  const markdownContent = htmlToMarkdown(content.htmlContent)
  parts.push(markdownContent)

  return parts.join('\n')
}

/**
 * Extract main content from HTML using simple heuristics
 */
export function extractMainContent(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Try to find main content container
  const mainSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ]

  for (const selector of mainSelectors) {
    const element = doc.querySelector(selector)
    if (element && element.textContent && element.textContent.trim().length > 100) {
      return element.innerHTML
    }
  }

  // Fallback to body
  return doc.body.innerHTML
}

/**
 * Generate a preview of the content (first N characters)
 */
export function generatePreview(content: string, maxLength = 200): string {
  const cleaned = content
    .replace(/[#*>`\-_]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return cleaned.slice(0, maxLength).trim() + '…'
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200
  const wordCount = text.trim().split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}
