# 📚 Video Learning Accelerator

Transform passive video watching into active, intelligent learning with AI-powered chapter generation.

## ✨ Features

### 🤖 AI-Powered Chapter Generation (NEW APIs!)
- Uses Chrome's **Writer API** for intelligent content generation
- Uses **Rewriter API** for improving chapter titles and summaries
- Uses **Proofreader API** for fixing transcript errors
- Uses **Summarizer API** for condensing long content
- Works offline once Gemini Nano model is downloaded
- Privacy-first: all processing happens locally on your device

### 🎯 Smart Navigation
- **Click-to-seek**: Jump to any chapter instantly
- **Auto-highlight**: Current chapter highlights as video plays
- **Visual timeline**: See video structure at a glance

### 📤 Export & Share
- Export chapters as JSON for notes or documentation
- Share chapter breakdowns with study groups
- Integrate with note-taking apps

### 🌐 Multi-Platform Support
- ✅ YouTube
- ✅ Coursera
- ✅ Udemy
- ✅ LinkedIn Learning

### 🎨 Beautiful UI
- Clean, modern sidebar interface
- Dark/light mode support
- Responsive design
- Smooth animations

### 🆕 Enhanced Features (NEW!)
- **📝 Interactive Transcript Tab** - Full transcript with clickable timestamps
- **🧠 AI-Generated Quiz Tab** - Test knowledge with 5 questions + explanations
- **💡 Double-Click to Explain** - Double-click video or press Alt+E for instant AI explanations
- **⌨️ Keyboard Shortcuts** - 6 shortcuts for power users (Alt+G, Alt+C, Alt+T, Alt+Q, Alt+E, Alt+X)
- **🎯 3-Tab Interface** - Chapters, Transcript, Quiz
- **📊 Progress Tracking** - Visual progress bars and quiz scoring
- **🔗 Deep Linking** - Quiz questions link to relevant timestamps

## 🚀 Installation

### Prerequisites

**⚠️ IMPORTANT: Chrome Built-in AI Setup Required**

This extension uses Chrome's new Built-in AI APIs:
- ✏️ **Writer API** - Generate chapters and quiz questions
- 🖊️ **Rewriter API** - Improve text quality
- 🔤 **Proofreader API** - Fix grammar and spelling
- 📄 **Summarizer API** - Create concise summaries
- 🌐 **Translator API** - Multi-language support

**Setup Requirements:**
1. Use **Chrome Dev** or **Chrome Canary** 137+ (not regular Chrome)
2. Join the **Origin Trial** and add token to manifest
3. Enable Chrome flags for each API
4. Download Gemini Nano model (~22GB)

**📖 See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete setup instructions**

Without AI setup, the extension will work in "Fallback Mode" with basic features only.

### From Source (Development)

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/video-learning-accelerator.git
   cd video-learning-accelerator
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the extension folder
   - Extension icon should appear in toolbar

4. **Enable Chrome AI (if not already enabled)**
   - Chrome 127+ required
   - AI features may need to be enabled in `chrome://flags`
   - Search for "Prompt API" and enable it

## 📖 Usage

### Basic Usage

1. **Visit a supported video platform**
   - Go to YouTube, Coursera, Udemy, or LinkedIn Learning
   - Open any video

2. **Extension auto-activates**
   - Sidebar appears on the right side
   - Extension detects video automatically

3. **Generate chapters**
   - Click "Generate Chapters" button
   - AI analyzes the video content (10-30 seconds)
   - Chapters appear in sidebar

4. **Navigate with chapters**
   - Click any chapter to jump to that timestamp
   - Current chapter highlights as video plays
   - Export chapters using the export button

### Advanced Features

#### 📝 Transcript Tab
- Click "Transcript" tab to view full transcript
- Click any purple timestamp to jump to that moment
- Real YouTube captions when available
- Fallback to estimated timestamps

#### 🧠 Quiz Tab
- Click "Quiz" tab after generating chapters
- Click "Generate Quiz" for 5 AI questions
- Answer questions with instant feedback
- See grade, stats, and answer review
- Click "Review at X:XX" to jump to relevant chapter

#### 💡 Click-to-Explain
- **Double-click** anywhere on the video
- OR press **Alt+E** keyboard shortcut
- AI explains what's happening at that moment
- Tooltip auto-dismisses after 8 seconds
- Works best after generating chapters

#### ⌨️ Keyboard Shortcuts
- **Alt+G** - Generate chapters
- **Alt+C** - Switch to Chapters tab
- **Alt+T** - Switch to Transcript tab
- **Alt+Q** - Switch to Quiz tab
- **Alt+E** - Explain current moment
- **Alt+X** - Close sidebar
- Click ⌨️ icon in header to see all shortcuts

#### Export Chapters
- Click the 📥 Export button in chapters header
- Downloads JSON file with all chapter data
- Includes video metadata and timestamps

#### Copy to Clipboard
- Click the 📋 Copy button
- Formatted text copied to clipboard
- Paste into notes or documents

## 🛠️ Technical Details

### Architecture

```
┌─────────────────┐
│  Content Script │  ← Runs on video pages
│   (content.js)  │  ← Detects videos, creates UI
└────────┬────────┘
         │
         ↓ Messages
┌─────────────────┐
│ Background SW   │  ← Service worker
│ (background.js) │  ← Routes messages, manages offscreen
└────────┬────────┘
         │
         ↓ Forwards to
┌─────────────────┐
│ Offscreen Doc   │  ← AI processing
│ (offscreen.js)  │  ← Chrome AI APIs
└─────────────────┘
```

### AI Processing

1. **Transcript Extraction**
   - Platform-specific selectors for each video site
   - Falls back to page metadata if transcript unavailable

2. **AI Analysis (NEW APIs!)**
   - **Writer API**: Generates chapters from transcript analysis
   - **Rewriter API**: Improves chapter titles and summaries
   - **Proofreader API**: Fixes grammar in transcripts
   - **Summarizer API**: Creates concise chapter summaries
   - Sends context-aware prompts with video metadata
   - Parses and validates JSON responses

3. **Fallback System**
   - If Writer API unavailable: tries Summarizer + Rewriter combo
   - If all AI unavailable: rule-based chapter generation
   - Divides content into logical sections
   - Always provides useful output

### File Structure

```
video-learning-accelerator/
├── manifest.json           # Extension configuration
├── background.js          # Service worker
├── content.js            # Content script (video pages)
├── offscreen.html        # Offscreen document
├── offscreen.js          # AI processing
├── popup.html            # Extension popup
├── popup.js              # Popup logic
├── popup.css             # Popup styles
├── sidebar.css           # Sidebar styles
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## 🔧 Development

### Prerequisites
- Chrome 127+ (for AI features)
- Basic knowledge of Chrome extensions
- Text editor or IDE

### Local Development

1. **Make changes to source files**
   - Edit JavaScript, CSS, or HTML files
   - No build process required (vanilla JS)

2. **Reload extension**
   - Go to `chrome://extensions/`
   - Click reload icon on extension card
   - Or use Ctrl+R on extensions page

3. **Test on video platforms**
   - Open YouTube or other supported platform
   - Check console for debug messages (F12)
   - Use `window.vlaDebug()` in console for status

### Debug Tips

```javascript
// In browser console on video page:

// Check extension status
window.vlaDebug();

// Check if video detected
document.querySelector('video');

// Check transcript extraction
transcriptText;

// Check generated chapters
chapterData;
```

## 🐛 Troubleshooting

### Extension not appearing
- Check that you're on a supported platform (YouTube, Coursera, Udemy, LinkedIn Learning)
- Refresh the page
- Check browser console for errors

### Chapters not generating
- Ensure video is playing or has played
- Check that transcript is available (try playing video first)
- Look for error messages in sidebar
- Check if Chrome AI APIs are available in your region

### AI not available
- Chrome 137+ (Dev/Canary) required
- Enable flags: `chrome://flags/#writer-api-for-gemini-nano`
- Join origin trial and add token to manifest.json
- Download Gemini Nano model (22GB storage needed)
- AI may not be available in all regions yet
- Extension will use fallback chapter generation
- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions

### Transcript extraction failing
- Some platforms may block transcript access
- Extension will use page title and description as fallback
- Try playing the video to trigger transcript loading

## 🚀 Roadmap

### Planned Features
- [ ] Quiz generation from chapters
- [ ] Note-taking integration
- [ ] Bookmark important moments
- [ ] Multi-language support
- [ ] Custom chapter editing
- [ ] Keyboard shortcuts
- [ ] Chapter search
- [ ] Video speed recommendations
- [ ] Learning progress tracking
- [ ] Cross-video learning paths

### Future Platforms
- [ ] Vimeo
- [ ] Khan Academy
- [ ] edX
- [ ] Skillshare
- [ ] Pluralsight

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 💬 Support

- **Issues**: Report bugs on GitHub Issues
- **Questions**: Open a discussion on GitHub
- **Email**: support@videolearningaccelerator.com

## 🙏 Acknowledgments

- Built with Chrome's experimental AI APIs
- Design system inspired by Perplexity AI
- Icons from various open-source projects

## 📊 Privacy

- **No data collection**: All processing happens locally
- **No external APIs**: Uses Chrome's built-in AI only
- **No tracking**: No analytics or telemetry
- **Open source**: Code is fully auditable

Your video transcripts never leave your browser.

---

**Made with ❤️ for learners everywhere**

Star ⭐ this repo if you find it useful!
