# Linear Web Clipper

A Chrome extension to clip web pages and YouTube transcripts, creating Linear issues with optional AI-powered summarization and transcript reformatting.

## Features

- **Web Page Clipping**: Extract and convert web page content to clean Markdown using Mozilla Readability
- **YouTube Transcript Extraction**: Automatically extract and reformat video transcripts into readable article format
- **Linear Integration**: Create issues directly in your Linear workspace with full Markdown support
- **AI-Powered Processing**:
  - Content summarization for quick insights
  - Automatic transcript reformatting (removes timestamps, combines fragments, adds paragraphs)
  - Support for OpenAI, Anthropic Claude, and Google Gemini
- **Team & Project Selection**: Organize clips by Linear teams and projects
- **Metadata Extraction**: Automatically capture page title, URL, description, and reading time
- **Clean UI**: Modern, accessible sidepanel interface following WAI-ARIA best practices

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Development Mode

For development with hot reload:
```bash
pnpm dev
```

## Setup

### 1. Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Create a new Personal API key
3. Copy the key (starts with `lin_api_`)

### 2. Configure Extension

1. Click the extension icon in Chrome
2. Enter your Linear API key
3. (Optional) Configure AI processing:
   - Select AI provider (OpenAI, Anthropic, or Google Gemini)
   - Enter your AI API key
   - Enable "Auto-summarize on clip" for automatic summarization
4. (Optional) Set default team and project
5. Click "Save Settings"

## Usage

### Clipping Web Pages

1. Navigate to any web page you want to clip
2. Click the extension icon or open the sidepanel
3. The extension will automatically:
   - Extract page content using Mozilla Readability
   - Convert to clean Markdown
   - Populate the issue title
   - Estimate reading time
4. (Optional) Click "Generate Summary" for AI-powered summarization
5. Select a Linear team (required)
6. (Optional) Select a project
7. Click "Create Issue"

### Clipping YouTube Transcripts

1. Navigate to any YouTube video (`youtube.com/watch?v=...`)
2. Open the extension sidepanel
3. The extension will automatically:
   - Click the video description's "Show transcript" button
   - Extract all transcript segments
   - **Automatically reformat** the transcript into article format (if AI is configured):
     - Removes timestamp markers
     - Combines sentence fragments
     - Organizes into logical paragraphs
     - Adds section headings
     - Fixes transcription errors
   - If AI is not configured, shows raw transcript with timestamps
4. Review the reformatted content
5. (Optional) Generate a summary for a concise overview
6. Create the Linear issue

### Auto-Summarization

Enable "Auto-summarize on clip" in settings to automatically generate summaries when pages are clipped. Note: YouTube transcripts are always reformatted (if AI configured), and auto-summarization is separate.

### Keyboard Shortcuts

The extension respects standard Chrome extension shortcuts. You can configure custom shortcuts in `chrome://extensions/shortcuts`.

## Features in Detail

### Content Extraction

**Web Pages:**
- Uses Mozilla Readability for intelligent content extraction
- Removes navigation, ads, comments, and boilerplate
- Extracts title, URL, meta description
- Calculates reading time estimate
- Preserves images, code blocks, and formatting

**YouTube Videos:**
- Automatically detects YouTube video pages
- Clicks "Show transcript" button
- Extracts all transcript segments
- Preserves timestamps for reference

### Markdown Conversion

Converts HTML to clean Markdown with:
- Proper heading hierarchy (h1-h6)
- Fenced code blocks with language detection
- Ordered and unordered lists (with nesting)
- Links and images (with alt text and captions)
- Tables (GitHub Flavored Markdown)
- Strikethrough and emphasis
- Block quotes
- Video embeds (YouTube, Vimeo, Loom, etc.)

### Linear Integration

- Fetches all teams and projects from your workspace via GraphQL API
- Creates issues with full Markdown formatting support
- Automatically opens the created issue in a new tab
- Supports project assignment
- Adds AI summaries as comments (when available)
- Handles long content (up to 250,000 characters)

### AI Processing

**Supported Providers:**
- **OpenAI** (gpt-4o-mini) - Fast and cost-effective
- **Anthropic** (claude-3-5-haiku-20241022) - High quality understanding
- **Google Gemini** (gemini-2.0-flash) - Excellent multilingual support

**Capabilities:**
1. **Summarization**: Condenses long content into key points and main ideas
2. **Transcript Reformatting**: Transforms YouTube transcripts into readable articles
   - Removes timestamp markers
   - Combines fragmented sentences
   - Adds paragraph breaks and section headings
   - Fixes grammar and transcription errors
   - Maintains all original information
3. **Hierarchical Processing**: For very long content, processes in chunks and combines results

## Project Structure

```
linear-web-clipper/
├── src/
│   ├── background/          # Service worker
│   │   └── index.ts
│   ├── content/             # Content script
│   │   └── main.tsx
│   ├── popup/               # Extension popup (settings)
│   │   ├── App.tsx
│   │   └── App.css
│   ├── sidepanel/           # Main clipper UI
│   │   ├── App.tsx
│   │   └── App.css
│   └── lib/                 # Shared utilities
│       ├── content-extractor.ts
│       ├── messages.ts
│       └── storage.ts
├── manifest.config.ts       # Extension manifest
├── vite.config.ts          # Build configuration
└── package.json
```

## API Keys Security

- All API keys are stored locally in Chrome's secure storage
- Keys are never transmitted except to their respective services
- Keys are not included in any logs or analytics

## Permissions

The extension requires:
- `sidePanel`: Display the clipper interface
- `activeTab`: Read current page content
- `storage`: Save settings and preferences
- `scripting`: Inject content extraction scripts
- `https://*/*`: Access web pages for clipping

## Development

### Technologies

- **React 19** with TypeScript for modern, type-safe UI
- **Vite** for fast builds and Hot Module Replacement
- **CRXJS** for Chrome Extension Manifest V3 development
- **Turndown** with GitHub Flavored Markdown plugin for HTML conversion
- **Mozilla Readability** for intelligent content extraction
- **Vercel AI SDK** for unified AI provider interface
- **Linear GraphQL API** for workspace integration

### Build Commands

```bash
# Development with hot reload
pnpm dev

# Production build
pnpm build

# Preview production build
pnpm preview
```

### Adding Features

The codebase follows a modular architecture:

1. **Background Service Worker** (`src/background/index.ts`): Handles API calls and cross-origin requests
2. **Message Passing** (`src/lib/messages.ts`): Communication between components
3. **Storage** (`src/lib/storage.ts`): Settings persistence
4. **Content Extraction** (`src/lib/content-extractor.ts`): HTML to Markdown conversion

## Troubleshooting

### Extension not loading
- Check that you've built the extension (`pnpm build`)
- Verify the `dist` directory exists
- Try removing and re-adding the extension

### Content extraction fails
- Some pages may have anti-scraping measures or dynamic content loading
- Try refreshing the page and clipping again
- Check browser console (F12) for errors
- For YouTube: Ensure the video has transcripts available

### YouTube transcript extraction fails
- Not all videos have transcripts (auto-generated or uploaded)
- The video description must be expanded to access transcripts
- Check if you can manually see "Show transcript" button on the page
- Some private or restricted videos don't provide transcripts

### Linear API errors
- Verify your API key is correct and starts with `lin_api_`
- Ensure the key has necessary permissions (create issues, read teams)
- Check you have access to the selected team/project
- Linear API keys can be managed at https://linear.app/settings/api

### AI processing not working
- Verify your AI provider API key is correct
- Check you have API credits/quota remaining
- OpenAI keys start with `sk-`
- Anthropic keys start with `sk-ant-`
- Very long transcripts may take 30-60 seconds to process

## Privacy & Security

This extension:
- **Does not collect** any analytics, telemetry, or usage data
- **Does not transmit** data to third parties except:
  - Linear API (for creating issues)
  - Your chosen AI provider (only when AI features are used)
- **Stores all data locally** in Chrome's secure storage API
- **API keys are encrypted** by Chrome's storage mechanism
- **Open source** for full transparency and auditing
- **No external dependencies** at runtime (all processing happens locally or via your APIs)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Acknowledgments

Built with these excellent open source tools:
- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [CRXJS](https://crxjs.dev/vite-plugin) - Chrome extension plugin
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter
- [Mozilla Readability](https://github.com/mozilla/readability) - Content extraction
- [Vercel AI SDK](https://sdk.vercel.ai/) - Unified AI provider interface
- [Linear API](https://developers.linear.app/) - Issue tracking integration

## Changelog

### v1.0.0 (2025)
- Initial release
- Web page content extraction with Readability
- YouTube transcript extraction and reformatting
- Linear issue creation with teams and projects
- AI-powered summarization (OpenAI, Anthropic, Gemini)
- Automatic transcript-to-article conversion
- Clean, accessible sidepanel UI
