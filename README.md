# Linear Web Clipper (v2.1)

> A Chrome extension to clip web pages and YouTube transcripts, creating Linear issues with AI-powered summarization.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue.svg)](https://chrome.google.com/webstore)

## Demo

[![Watch Demo](https://img.youtube.com/vi/l8bcRzbNW6U/maxresdefault.jpg)](https://youtu.be/Fcfu6gtblDc)

[▶️ Watch Demo Video](https://youtu.be/Fcfu6gtblDc)

## Features

- 📄 **Web Page Clipping** - Extract clean content using Mozilla Readability, convert to Markdown
- 🎥 **YouTube Transcripts** - Auto-extract and reformat video transcripts into readable articles
- 🤖 **AI-Powered** - Summarize content and reformat transcripts with 8 providers (OpenAI, Anthropic, Gemini, DeepSeek, Grok, Groq, Mistral, OpenRouter)
- 🔄 **Multi-Provider Fallback** - Configure multiple AI providers in priority order; if one fails, the next is tried automatically
- 📋 **Linear Integration** - Create issues directly in your workspace with full Markdown support
- ⚙️ **Customizable** - Dedicated settings page with drag-and-drop provider ordering, connection testing, default teams/projects, and auto-summarization

## Installation

### From Chrome Web Store

Coming soon...

### From Source

```bash
# Clone and install
git clone https://github.com/jingsu96/linear-web-clipper.git
cd linear-web-clipper
pnpm install

# Build
pnpm build

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select the `dist` folder
```

## Quick Start

1. **Get a Linear API key** from [linear.app/settings/api](https://linear.app/settings/api)
2. **Configure the extension** - Click the extension icon and enter your API key
3. **Start clipping** - Navigate to any page or YouTube video and open the sidepanel

### Optional: Enable AI Features

Add one or more AI providers in the settings page (AI tab) for summarization and transcript reformatting. Providers are tried in the order you set — if one fails, the next takes over automatically.

| Provider | API Key |
|----------|---------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| **Grok (xAI)** | [console.x.ai](https://console.x.ai) |
| **Groq** | [console.groq.com](https://console.groq.com/keys) |
| **Mistral AI** | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai/keys) (supports custom model IDs) |

## Usage

### Clip Web Pages

1. Open any article or documentation page
2. Click the extension icon to open sidepanel
3. Review extracted content
4. (Optional) Generate AI summary
5. Select team/project and click "Create Issue"

### Clip YouTube Transcripts

1. Open any YouTube video
2. Open the sidepanel
3. Extension auto-extracts and reformats transcript
4. (Optional) Generate summary
5. Create Linear issue

## Tech Stack

- **React 19** + TypeScript
- **Vite** + CRXJS (Chrome Extension MV3)
- **Mozilla Readability** - Content extraction
- **Turndown** - HTML to Markdown conversion
- **Vercel AI SDK** - Unified AI provider interface
- **Linear GraphQL API** - Issue management

## Development

```bash
# Start dev server with HMR
pnpm dev

# Build for production
pnpm build

# Preview build
pnpm preview
```

## Privacy

- ✅ No data collection or analytics
- ✅ All settings stored locally (encrypted)
- ✅ Direct API calls to Linear/AI providers only
- ✅ Open source - fully auditable

[Full Privacy Policy](https://jingsu96.github.io/linear-web-clipper/privacy.html)

## Permissions

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display clipper UI |
| `activeTab` | Read page content |
| `storage` | Store settings locally |
| `scripting` | Extract content from pages |
| `<all_urls>` | Clip from any website |

## Troubleshooting

**Extension not loading?**
- Run `pnpm build` and check `dist/` exists
- Reload extension in `chrome://extensions/`

**YouTube transcript fails?**
- Not all videos have transcripts
- Check if "Show transcript" button is visible
- Some private/restricted videos don't provide transcripts

**AI processing not working?**
- Use the "Test Connection" button in settings to verify each provider
- Check you have API credits remaining
- If using multiple providers, ensure at least one is enabled with a valid key
- Long transcripts may take 30-60 seconds

## Contributing

Contributions welcome! Please open an issue or submit a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

Built with these excellent tools:
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [CRXJS](https://crxjs.dev/vite-plugin)
- [Turndown](https://github.com/mixmark-io/turndown)
- [Mozilla Readability](https://github.com/mozilla/readability)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Linear API](https://developers.linear.app/)

---

Made with ❤️ by [Jinghuang Su](https://github.com/jingsu96)
