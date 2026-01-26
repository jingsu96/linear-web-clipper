# Linear Web Clipper (v2.1)

A Chrome extension that clips web pages and YouTube transcripts to create Linear issues with AI-powered summarization.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue.svg)](https://chrome.google.com/webstore)

## Demo

[![Watch Demo](https://img.youtube.com/vi/l8bcRzbNW6U/maxresdefault.jpg)](https://youtu.be/Fcfu6gtblDc)

[Watch Demo Video](https://youtu.be/Fcfu6gtblDc)

## Features

### Web Page Clipping
- Extract clean content using Mozilla Readability
- Convert HTML to optimized Markdown with Turndown
- Remove ads, comments, navigation, and sidebar elements
- Preserve images with alt text and captions
- Support embedded content (YouTube, Loom, Figma, Descript)

### YouTube Transcript Extraction
- Auto-detect YouTube video pages
- Extract transcript segments with timestamps
- Reformat raw transcripts into readable articles using AI

### AI-Powered Summarization
- Multiple summary styles: concise, educational, comprehensive, inspired, or custom
- Support for 25+ output languages
- Auto-summarization option on clip
- Chunk processing for long content

### Linear Integration
- Create issues directly in your workspace
- Full Markdown support with Linear auto-embed detection
- Select team and project
- Add AI summaries as issue comments
- Content validation (max 250K characters)

### Customization
- Set default team and project
- Configure metadata inclusion (URL, timestamp, description)
- Enable auto-summarization on clip

## Installation

### From Chrome Web Store

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/linear-web-clipper/ihlljgnlhkdcbdbedhkggjhkdgackphj)

### From Source

```bash
git clone https://github.com/jingsu96/linear-web-clipper.git
cd linear-web-clipper
pnpm install
pnpm build
```

Load in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist` folder

## Quick Start

1. Get a Linear API key from [linear.app/settings/api](https://linear.app/settings/api)
2. Click the extension icon and enter your API key in settings
3. Navigate to any page or YouTube video and open the sidepanel
4. Review extracted content, optionally generate a summary
5. Select team/project and click "Create Issue"

## AI Providers

Configure an AI provider in settings for summarization and transcript reformatting:

| Provider | Models | API Key |
|----------|--------|---------|
| OpenAI | GPT-4o, GPT-4o-mini, o1, o1-mini, o3-mini | [platform.openai.com](https://platform.openai.com/api-keys) |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| Google Gemini | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash | [aistudio.google.com](https://aistudio.google.com/apikey) |
| DeepSeek | DeepSeek V3, DeepSeek Reasoner | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Grok (xAI) | Grok 2, Grok 2 Vision, Grok Beta | [console.x.ai](https://console.x.ai) |

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, TypeScript |
| Build | Vite 7, CRXJS (Chrome Extension MV3) |
| Content Extraction | Mozilla Readability |
| Markdown Conversion | Turndown with GFM plugin |
| AI Integration | Vercel AI SDK v6 |
| API | Linear GraphQL API (@linear/sdk) |

## Development

```bash
# Start dev server with HMR
pnpm dev

# Build for production
pnpm build

# Preview build
pnpm preview
```

## Project Structure

```
src/
  background/      Service worker (content extraction, API calls)
  sidepanel/       Main clipper UI
  popup/           Settings page
  content/         Content script
  components/      Shared React components
  lib/
    storage.ts     Settings and local storage
    messages.ts    Chrome message passing
    content-extractor.ts   HTML to Markdown conversion
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display clipper UI |
| `activeTab` | Read page content |
| `storage` | Store settings locally |
| `scripting` | Extract content from pages |
| `<all_urls>` | Clip from any website |

## Privacy

- No data collection or analytics
- All settings stored locally (encrypted by Chrome)
- Direct API calls to Linear and AI providers only
- No intermediate servers
- Open source and fully auditable

[Full Privacy Policy](https://jingsu96.github.io/linear-web-clipper/privacy.html)

## Troubleshooting

**Extension not loading?**
- Run `pnpm build` and verify `dist/` folder exists
- Reload the extension in `chrome://extensions/`

**YouTube transcript extraction fails?**
- Not all videos have transcripts available
- Verify the "Show transcript" button is visible on the video page
- Private or restricted videos may not provide transcripts

**AI summarization not working?**
- Verify your API key is correct in settings
- Check that you have API credits remaining with your provider
- Long content may take 30-60 seconds to process

**Linear issue creation fails?**
- Verify your Linear API key is valid
- Check that you have write access to the selected team
- Content exceeding 250K characters will be truncated

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [CRXJS](https://crxjs.dev/vite-plugin)
- [Turndown](https://github.com/mixmark-io/turndown)
- [Mozilla Readability](https://github.com/mozilla/readability)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Linear API](https://developers.linear.app/)

---

Created by [Jinghuang Su](https://github.com/jingsu96)
