# Linear Web Clipper

A Chrome extension to clip web pages and create Linear issues with optional AI-powered summarization.

## Features

- **Web Page Clipping**: Extract and convert web page content to clean Markdown
- **Linear Integration**: Create issues directly in your Linear workspace
- **AI Summarization**: Optional content summarization using OpenAI or Anthropic
- **Team & Project Selection**: Organize clips by Linear teams and projects
- **Metadata Extraction**: Automatically capture page title, URL, and description
- **Clean UI**: Modern, accessible sidepanel interface

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
3. (Optional) Configure AI summarization:
   - Select AI provider (OpenAI or Anthropic)
   - Enter your AI API key
4. Click "Save Settings"

## Usage

### Basic Workflow

1. Navigate to any web page you want to clip
2. Click the extension icon or open the sidepanel
3. The extension will automatically:
   - Extract page content
   - Convert to Markdown
   - Populate the issue title
4. (Optional) Click "Generate Summary" for AI summarization
5. Select a Linear team (required)
6. (Optional) Select a project
7. Click "Create Issue"

### Auto-Summarization

Enable "Auto-summarize on clip" in settings to automatically generate summaries when pages are clipped.

### Keyboard Shortcuts

The extension respects standard Chrome extension shortcuts. You can configure custom shortcuts in `chrome://extensions/shortcuts`.

## Features in Detail

### Content Extraction

The extension extracts:
- Page title and URL
- Main content (automatically detected)
- Meta description
- Reading time estimate

### Markdown Conversion

Converts HTML to clean Markdown with:
- Proper heading hierarchy
- Code blocks (fenced)
- Lists (unordered and ordered)
- Links and images
- Strikethrough and emphasis
- Block quotes

### Linear Integration

- Fetches all teams and projects from your workspace
- Creates issues with full Markdown formatting
- Automatically opens the created issue in a new tab
- Supports project assignment

### AI Summarization

Supported providers:
- **OpenAI** (gpt-4o-mini)
- **Anthropic** (claude-3-5-haiku)

Summaries are prepended to the issue description, separated by a horizontal rule.

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

- **React 19** with TypeScript
- **Vite** for fast builds and HMR
- **CRXJS** for Chrome extension development
- **Turndown** for HTML to Markdown conversion
- **Linear SDK** for API integration

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
- Some pages may have anti-scraping measures
- Try refreshing the page and clipping again
- Check browser console for errors

### Linear API errors
- Verify your API key is correct
- Ensure the key has necessary permissions
- Check you have access to the selected team/project

### AI summarization not working
- Verify your AI provider API key is correct
- Check you have API credits/quota
- Try a shorter page (API has input limits)

## Privacy

This extension:
- Does not collect any analytics or telemetry
- Does not transmit data to third parties (except Linear and optional AI provider)
- Stores all data locally in your browser
- Is open source for full transparency

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Credits

Built with:
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [CRXJS](https://crxjs.dev/vite-plugin)
- [Turndown](https://github.com/mixmark-io/turndown)
- [Linear SDK](https://github.com/linear/linear)
