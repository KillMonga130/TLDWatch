/**
 * Content Script - Video Learning Accelerator - ENHANCED
 * Runs on video platforms and handles UI/interaction
 */

console.log('[VLA] Content script loaded on:', window.location.hostname);

let currentVideo = null;
let transcriptText = '';
let chapterData = [];
let isProcessing = false;
let videoMetadata = {
  title: '',
  duration: 0,
  url: '',
  platform: '',
  videoId: ''
};
let extractionAttempts = 0;
let maxExtractionAttempts = 5;
let lastVideoUrl = '';
let transcriptCache = new Map(); // Cache transcripts by video ID

// MAIN CLASS
class VideoAccelerator {
  constructor() {
    this.video = this.findVideo();
    this.platform = this.detectPlatform();
    this.sidebar = null;
    console.log('[VLA] Platform:', this.platform, 'Video found:', !!this.video);
    this.init();
  }

  findVideo() {
    return document.querySelector('video');
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('youtube')) return 'youtube';
    if (hostname.includes('coursera')) return 'coursera';
    if (hostname.includes('udemy')) return 'udemy';
    if (hostname.includes('linkedin')) return 'linkedin';
    return 'unknown';
  }

  async init() {
    if (!this.video) {
      console.log('[VLA] No video found, retrying in 2s...');
      setTimeout(() => {
        this.video = this.findVideo();
        if (this.video) {
          this.createSidebar();
          this.setupVideoListeners();
          this.setupUrlChangeDetection();
          // Try extracting transcript after a delay
          setTimeout(() => this.extractTranscript(), 2000);
        }
      }, 2000);
      return;
    }

    this.createSidebar();
    this.setupVideoListeners();
    this.setupUrlChangeDetection();

    // Try to load previously saved chapters
    setTimeout(() => this.loadChaptersFromStorage(), 1000);

    // Check if we have cached transcript for this video
    const videoId = this.getVideoId();
    if (videoId && transcriptCache.has(videoId)) {
      transcriptText = transcriptCache.get(videoId);
      console.log('[VLA] ✅ Using cached transcript:', transcriptText.length, 'chars');
    } else {
      // Try extracting transcript immediately
      this.extractTranscript();

      // Also try again after delays (page might still be loading)
      const retryDelays = [2000, 4000, 6000];
      retryDelays.forEach(delay => {
        setTimeout(() => {
          if ((!transcriptText || transcriptText.length < 100) && extractionAttempts < maxExtractionAttempts) {
            console.log('[VLA] Retrying transcript extraction (attempt', extractionAttempts + 1, ')...');
            this.extractTranscript();
          }
        }, delay);
      });
    }

    console.log('[VLA] ✅ Initialized');
  }

  getVideoId() {
    // Extract video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || '';
  }

  setupUrlChangeDetection() {
    // Detect when user navigates to a different video
    let lastUrl = window.location.href;

    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[VLA] URL changed, resetting for new video');
        lastUrl = currentUrl;
        this.handleVideoChange();
      }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 1000);

    // Also listen to popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      console.log('[VLA] Navigation detected');
      setTimeout(() => this.handleVideoChange(), 500);
    });
  }

  handleVideoChange() {
    // Reset state for new video
    const newVideoId = this.getVideoId();
    const oldVideoId = videoMetadata.videoId;

    if (newVideoId && newVideoId !== oldVideoId) {
      console.log('[VLA] New video detected:', newVideoId);

      // Reset state
      extractionAttempts = 0;
      chapterData = [];
      isProcessing = false;

      // Check cache first
      if (transcriptCache.has(newVideoId)) {
        transcriptText = transcriptCache.get(newVideoId);
        console.log('[VLA] ✅ Loaded cached transcript for new video');
      } else {
        transcriptText = '';
      }

      // Update video reference
      this.video = this.findVideo();

      // Clear chapters display
      const container = document.getElementById('vla-chapters-container');
      if (container) {
        container.innerHTML = '<p class="vla-loading">No chapters yet. Click Generate to start.</p>';
      }

      // Extract transcript for new video
      setTimeout(() => this.extractTranscript(), 1000);
      setTimeout(() => this.extractTranscript(), 3000);
    }
  }

  setupVideoListeners() {
    this.video.addEventListener('play', () => {
      console.log('[VLA] Video playing');
      // Extract transcript when video plays if not already extracted
      if (!transcriptText || transcriptText.length < 100) {
        this.extractTranscript();
      }
    });

    this.video.addEventListener('pause', () => {
      console.log('[VLA] Video paused');
    });

    // Track video progress to highlight current chapter (debounced)
    let timeupdateTimeout;
    this.video.addEventListener('timeupdate', () => {
      if (timeupdateTimeout) clearTimeout(timeupdateTimeout);
      timeupdateTimeout = setTimeout(() => {
        this.updateCurrentChapter();
      }, 200); // Debounce to every 200ms
    });

    this.video.addEventListener('loadedmetadata', () => {
      console.log('[VLA] Video metadata loaded, duration:', this.video.duration);
      this.extractVideoMetadata();
      // Try extracting transcript when metadata loads
      if (!transcriptText || transcriptText.length < 100) {
        this.extractTranscript();
      }
    });

    // Also try when video is ready
    this.video.addEventListener('canplay', () => {
      console.log('[VLA] Video can play');
      if (!transcriptText || transcriptText.length < 100) {
        setTimeout(() => this.extractTranscript(), 1000);
      }
    });
  }

  updateCurrentChapter() {
    if (!chapterData || chapterData.length === 0) return;

    const currentTime = this.video.currentTime;

    // Find the current chapter based on video time
    let currentChapterIndex = 0;
    for (let i = chapterData.length - 1; i >= 0; i--) {
      if (currentTime >= (chapterData[i].timestampSeconds || 0)) {
        currentChapterIndex = i;
        break;
      }
    }

    // Update active chapter highlight
    const items = document.querySelectorAll('.vla-chapter-item');
    items.forEach((item, index) => {
      if (index === currentChapterIndex) {
        item.classList.add('vla-chapter-active');
      } else {
        item.classList.remove('vla-chapter-active');
      }
    });
  }

  createSidebar() {
    if (this.sidebar) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'vla-sidebar';
    sidebar.innerHTML = `
      <div class="vla-header">
        <h3>📚 Video Accelerator</h3>
        <div class="vla-header-actions">
          <button id="vla-shortcuts-btn" class="vla-btn-icon" title="Keyboard Shortcuts">⌨️</button>
          <button id="vla-close" class="vla-btn-close">✕</button>
        </div>
      </div>

      <div class="vla-tabs">
        <button class="vla-tab-btn active" data-tab="chapters">📚 Chapters</button>
        <button class="vla-tab-btn" data-tab="transcript">📝 Transcript</button>
        <button class="vla-tab-btn" data-tab="quiz">🧠 Quiz</button>
        <button class="vla-tab-btn" data-tab="recommendations">✨ Related</button>
      </div>

      <div class="vla-content">
        <div class="vla-tab-content active" id="chapters-tab">
          <div id="vla-chapters-container">
            <p class="vla-loading">No chapters yet. Click Generate to start.</p>
          </div>
          <button id="vla-generate-btn" class="vla-btn-primary">Generate Chapters</button>
        </div>

        <div class="vla-tab-content" id="transcript-tab">
          <div class="vla-transcript-header">
            <h4>Video Transcript</h4>
            <p class="vla-transcript-subtitle">Click timestamps to jump</p>
          </div>
          <div id="vla-transcript-container">
            <p class="vla-loading">Transcript will appear here...</p>
          </div>
        </div>

        <div class="vla-tab-content" id="quiz-tab">
          <div class="vla-quiz-header">
            <h4>Knowledge Check</h4>
            <p class="vla-quiz-subtitle">AI-generated questions</p>
          </div>
          <div id="vla-quiz-container">
            <p class="vla-loading">Generate chapters first to create quiz</p>
          </div>
          <button id="vla-generate-quiz-btn" class="vla-btn-primary" style="display:none;">Generate Quiz</button>
        </div>

        <div class="vla-tab-content" id="recommendations-tab">
          <div class="vla-recommendations-header">
            <h4>Related Learning</h4>
            <p class="vla-recommendations-subtitle">Continue your learning journey</p>
          </div>
          <div id="vla-recommendations-container">
            <p class="vla-loading">Recommendations will appear here...</p>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(sidebar);
    this.sidebar = sidebar;

    // Event listeners
    document.getElementById('vla-close').addEventListener('click', () => this.sidebar.remove());
    document.getElementById('vla-generate-btn').addEventListener('click', () => this.generateChapters());

    document.getElementById('vla-shortcuts-btn')?.addEventListener('click', () => {
      this.showShortcutsModal();
    });

    document.querySelectorAll('.vla-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('vla-debug-btn')?.addEventListener('click', () => {
      console.log('[VLA] Debug:', {
        video: this.video ? 'Found' : 'Not found',
        platform: this.platform,
        videoId: this.getVideoId(),
        transcript: transcriptText.substring(0, 100),
        transcriptLength: transcriptText.length,
        chapters: chapterData.length,
        extractionAttempts: extractionAttempts,
        cacheSize: transcriptCache.size,
        metadata: videoMetadata
      });
      alert('Check console for debug info');
    });

    document.getElementById('vla-generate-quiz-btn')?.addEventListener('click', () => this.generateQuiz());

    this.checkAICapabilities();
    this.setupClickToExplain();
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt+G: Generate chapters
      if (e.altKey && e.key === 'g') {
        e.preventDefault();
        const btn = document.getElementById('vla-generate-btn');
        if (btn && !btn.disabled) {
          btn.click();
        }
      }

      // Alt+T: Switch to transcript tab
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        this.switchTab('transcript');
      }

      // Alt+Q: Switch to quiz tab
      if (e.altKey && e.key === 'q') {
        e.preventDefault();
        this.switchTab('quiz');
      }

      // Alt+C: Switch to chapters tab
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        this.switchTab('chapters');
      }

      // Alt+X: Close sidebar
      if (e.altKey && e.key === 'x') {
        e.preventDefault();
        if (this.sidebar) {
          this.sidebar.remove();
        }
      }

      // Escape: Close shortcuts modal
      if (e.key === 'Escape') {
        const modal = document.getElementById('vla-shortcuts-modal');
        if (modal) modal.remove();
      }
    });
  }

  showShortcutsModal() {
    // Remove existing modal if any
    const existing = document.getElementById('vla-shortcuts-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'vla-shortcuts-modal';
    modal.className = 'vla-modal-overlay';
    modal.innerHTML = `
      <div class="vla-modal-content">
        <div class="vla-modal-header">
          <h3>⌨️ Keyboard Shortcuts</h3>
          <button class="vla-modal-close">✕</button>
        </div>
        <div class="vla-modal-body">
          <div class="vla-shortcut-item">
            <kbd>Alt</kbd> + <kbd>G</kbd>
            <span>Generate Chapters</span>
          </div>
          <div class="vla-shortcut-item">
            <kbd>Alt</kbd> + <kbd>C</kbd>
            <span>Chapters Tab</span>
          </div>
          <div class="vla-shortcut-item">
            <kbd>Alt</kbd> + <kbd>T</kbd>
            <span>Transcript Tab</span>
          </div>
          <div class="vla-shortcut-item">
            <kbd>Alt</kbd> + <kbd>Q</kbd>
            <span>Quiz Tab</span>
          </div>
          <div class="vla-shortcut-item">
            <kbd>Alt</kbd> + <kbd>X</kbd>
            <span>Close Sidebar</span>
          </div>
          <div class="vla-shortcut-item">
            <kbd>Esc</kbd>
            <span>Close This Modal</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Close button
    modal.querySelector('.vla-modal-close').addEventListener('click', () => {
      modal.remove();
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.vla-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.vla-tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  extractTranscript() {
    extractionAttempts++;
    console.log('[VLA] Starting transcript extraction (attempt', extractionAttempts, ') for platform:', this.platform);

    // Check if we already have a good transcript
    if (transcriptText && transcriptText.length > 200) {
      console.log('[VLA] ✅ Already have good transcript, skipping extraction');
      return;
    }

    let transcript = null;

    // Platform-specific transcript extraction
    switch (this.platform) {
      case 'youtube':
        transcript = this.extractYouTubeTranscript();
        break;
      case 'coursera':
        transcript = this.extractCourseraTranscript();
        break;
      case 'udemy':
        transcript = this.extractUdemyTranscript();
        break;
      case 'linkedin':
        transcript = this.extractLinkedInTranscript();
        break;
      default:
        transcript = this.extractGenericTranscript();
    }

    if (transcript && transcript.length > 50) {
      transcriptText = transcript;

      // Cache the transcript
      const videoId = this.getVideoId();
      if (videoId) {
        transcriptCache.set(videoId, transcript);
        console.log('[VLA] 💾 Cached transcript for video:', videoId);
      }

      console.log('[VLA] ✅ Transcript extracted successfully:', transcriptText.length, 'characters');
      console.log('[VLA] Preview:', transcriptText.substring(0, 150) + '...');

      // Update status in sidebar if it exists
      this.updateTranscriptStatus('success', transcriptText.length);
    } else {
      // Enhanced fallback to page metadata
      console.log('[VLA] No transcript found, using enhanced fallback...');

      const title = document.title;
      const description = document.querySelector('meta[name="description"]')?.content || '';
      const ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';
      const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.textContent.trim())
        .filter(t => t.length > 0 && t.length < 200)
        .slice(0, 10)
        .join('. ');

      // Try to get any visible text content
      const mainContent = document.querySelector('main, article, #content')?.textContent?.trim();
      const contentPreview = mainContent ? mainContent.substring(0, 500) : '';

      transcriptText = [title, description, ogDescription, keywords, headings, contentPreview]
        .filter(t => t && t.length > 0)
        .join('. ')
        .replace(/\s+/g, ' ')
        .trim();

      if (transcriptText.length < 100) {
        // Last resort: create meaningful text from title
        const words = title.split(/\s+/).filter(w => w.length > 2);
        transcriptText = `${title}. This video discusses ${words.slice(0, 5).join(', ')}. The content explores topics related to ${words.slice(-3).join(' and ')}.`;
      }

      console.log('[VLA] ⚠️ Using fallback metadata:', transcriptText.length, 'characters');
      this.updateTranscriptStatus('fallback', transcriptText.length);
    }

    // Extract video metadata
    this.extractVideoMetadata();
  }

  updateTranscriptStatus(status, length) {
    const statusEl = document.getElementById('vla-transcript-status');
    if (statusEl) {
      if (status === 'success') {
        statusEl.innerHTML = `✅ Transcript: ${length} chars`;
        statusEl.style.color = 'var(--color-success)';
      } else if (status === 'fallback') {
        statusEl.innerHTML = `⚠️ Using metadata: ${length} chars`;
        statusEl.style.color = 'var(--color-warning)';
      }
    }
  }

  extractYouTubeTranscript() {
    console.log('[VLA] Attempting YouTube transcript extraction...');

    // Method 1: Try to get transcript from YouTube's transcript panel
    const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer, ytd-transcript-segment-list-renderer [role="button"]');
    if (transcriptSegments.length > 0) {
      const transcript = Array.from(transcriptSegments)
        .map(seg => {
          const text = seg.querySelector('.segment-text, yt-formatted-string')?.textContent?.trim();
          return text;
        })
        .filter(t => t && t.length > 0)
        .join(' ');
      if (transcript.length > 100) {
        console.log('[VLA] ✅ Transcript extracted from transcript panel:', transcript.length, 'chars');
        return transcript;
      }
    }

    // Method 2: Try to click and open transcript panel if not already open
    const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
    if (transcriptButton && !document.querySelector('ytd-transcript-segment-renderer')) {
      console.log('[VLA] Attempting to open transcript panel...');
      transcriptButton.click();
      // Note: This won't work immediately, but will help for next extraction attempt
    }

    // Method 3: Try description (expanded with more selectors)
    const descriptionSelectors = [
      '#description-inline-expander',
      'ytd-text-inline-expander',
      '#description',
      'yt-formatted-string.content',
      '#description-inner',
      '.ytd-video-secondary-info-renderer #description',
      'ytd-expandable-video-description-body-renderer',
      '#snippet-text',
      '.ytd-expandable-video-description-body-renderer'
    ];

    for (const selector of descriptionSelectors) {
      const description = document.querySelector(selector)?.textContent?.trim();
      if (description && description.length > 100) {
        console.log('[VLA] ✅ Using video description as transcript:', description.length, 'chars');
        return description;
      }
    }

    // Method 4: Try to extract from video info
    const videoInfo = document.querySelector('ytd-watch-metadata, ytd-video-primary-info-renderer');
    if (videoInfo) {
      const infoText = videoInfo.textContent?.trim();
      if (infoText && infoText.length > 100) {
        console.log('[VLA] ✅ Using video info as transcript:', infoText.length, 'chars');
        return infoText;
      }
    }

    // Method 5: Try video title + metadata + tags + comments
    const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title, #title h1, h1.ytd-watch-metadata__title')?.textContent?.trim();
    const metaDescription = document.querySelector('meta[name="description"]')?.content;
    const ogDescription = document.querySelector('meta[property="og:description"]')?.content;
    const channel = document.querySelector('#channel-name, ytd-channel-name a, #owner-name a')?.textContent?.trim();
    const category = document.querySelector('meta[itemprop="genre"]')?.content;

    // Try to get hashtags
    const hashtags = Array.from(document.querySelectorAll('a[href*="/hashtag/"]'))
      .map(a => a.textContent?.trim())
      .filter(t => t)
      .join(' ');

    // Try to get some text from comments as additional context
    const comments = Array.from(document.querySelectorAll('#content-text, ytd-comment-renderer #content-text'))
      .slice(0, 10)
      .map(c => c.textContent?.trim())
      .filter(t => t && t.length > 20 && t.length < 500)
      .join('. ');

    // Try to get related video titles for context
    const relatedTitles = Array.from(document.querySelectorAll('#video-title'))
      .slice(0, 5)
      .map(t => t.textContent?.trim())
      .filter(t => t && t.length > 10)
      .join('. ');

    const combined = [
      title,
      `Channel: ${channel}`,
      category ? `Category: ${category}` : '',
      metaDescription,
      ogDescription,
      hashtags,
      comments,
      relatedTitles
    ]
      .filter(t => t && t.length > 0)
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim();

    if (combined.length > 50) {
      console.log('[VLA] ✅ Using combined metadata as transcript:', combined.length, 'chars');
      return combined;
    }

    console.log('[VLA] ⚠️ Could not extract meaningful transcript from YouTube');
    return null;
  }

  extractCourseraTranscript() {
    // Coursera transcript selectors
    const transcript = document.querySelector('.rc-CML__transcript, [data-testid="transcript"]');
    if (transcript) {
      return transcript.textContent.trim();
    }

    // Try video description
    const description = document.querySelector('.video-description, .course-description');
    if (description) {
      return description.textContent.trim();
    }

    return null;
  }

  extractUdemyTranscript() {
    // Udemy transcript selectors
    const transcript = document.querySelector('[data-purpose="transcript-cue"], .transcript--transcript-container--3EqFW');
    if (transcript) {
      return transcript.textContent.trim();
    }

    // Try curriculum description
    const description = document.querySelector('[data-purpose="course-description"], .ud-text-md');
    if (description) {
      return description.textContent.trim();
    }

    return null;
  }

  extractLinkedInTranscript() {
    // LinkedIn Learning transcript selectors
    const transcript = document.querySelector('.transcript-line, [data-control-name="transcript"]');
    if (transcript) {
      return transcript.textContent.trim();
    }

    // Try course description
    const description = document.querySelector('.course-description, .description-text');
    if (description) {
      return description.textContent.trim();
    }

    return null;
  }

  extractGenericTranscript() {
    // Generic selectors for any platform
    const selectors = [
      '[aria-label*="transcript"]',
      '[aria-label*="caption"]',
      '.transcript',
      '.captions',
      '.subtitles',
      '[data-transcript]',
      '[data-captions]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.length > 50) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  extractVideoMetadata() {
    videoMetadata.platform = this.platform;
    videoMetadata.url = window.location.href;
    videoMetadata.duration = this.video?.duration || 0;

    // Platform-specific title extraction
    switch (this.platform) {
      case 'youtube':
        videoMetadata.title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title')?.textContent?.trim() || document.title;
        break;
      case 'coursera':
        videoMetadata.title = document.querySelector('h1, .video-title')?.textContent?.trim() || document.title;
        break;
      case 'udemy':
        videoMetadata.title = document.querySelector('[data-purpose="course-title"], h1')?.textContent?.trim() || document.title;
        break;
      case 'linkedin':
        videoMetadata.title = document.querySelector('.classroom-nav__title, h1')?.textContent?.trim() || document.title;
        break;
      default:
        videoMetadata.title = document.title;
    }

    console.log('[VLA] Video metadata:', videoMetadata);
  }

  async checkAICapabilities() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'checkAICapabilities' },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });

      console.log('[VLA] AI capabilities:', response);

      // Show AI status in sidebar if status element exists
      const statusEl = document.getElementById('vla-ai-status');
      if (statusEl && response && response.success && response.capabilities) {
        if (response.capabilities.available) {
          statusEl.innerHTML = '✅ <strong>AI Ready</strong><br><small>Gemini Nano available</small>';
          statusEl.style.color = '#4ade80';
        } else {
          statusEl.innerHTML = `⚠️ <strong>AI Unavailable</strong><br><small>Using fallback mode</small>`;
          statusEl.style.color = '#facc15';
          
          // Show helpful message
          if (response.capabilities.reason) {
            console.warn('[VLA] AI unavailable:', response.capabilities.reason);
          }
        }
      }
    } catch (error) {
      console.error('[VLA] AI check error:', error);
    }
  }

  async generateChapters() {
    if (isProcessing) return;

    // Try extracting transcript one more time if empty
    if (!transcriptText || transcriptText.length < 50) {
      console.log('[VLA] Transcript empty, attempting extraction...');
      this.extractTranscript();

      // Wait a moment for extraction
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!transcriptText || transcriptText.length < 50) {
      alert('No transcript available. The extension will use video metadata to generate basic chapters.');
      // Don't return - let it continue with whatever we have
    }

    isProcessing = true;
    const btn = document.getElementById('vla-generate-btn');
    const container = document.getElementById('vla-chapters-container');
    btn.disabled = true;
    btn.textContent = '🤖 Analyzing...';

    // Show loading state
    container.innerHTML = `
      <div class="vla-loading-state">
        <div class="vla-spinner"></div>
        <p>AI is analyzing the video content...</p>
        <p class="vla-loading-detail">This may take 10-30 seconds</p>
      </div>
    `;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'generateChapters',
            transcript: transcriptText,
            metadata: videoMetadata
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response && response.success && response.chapters) {
        chapterData = response.chapters;
        
        // Check if fallback was used
        const usedFallback = response.usedFallback || false;
        
        this.displayChapters(response.chapters, usedFallback);

        // Auto-save chapters to storage
        this.saveChaptersToStorage(response.chapters);

        // Also populate other tabs
        this.displayTranscript();
        this.displayRecommendations();

        // Show quiz generate button
        const quizBtn = document.getElementById('vla-generate-quiz-btn');
        if (quizBtn) quizBtn.style.display = 'block';

        // Show success message briefly
        if (usedFallback) {
          btn.textContent = '✅ Generated (Fallback)';
          console.log('[VLA] Chapters generated using fallback mode (AI unavailable)');
        } else {
          btn.textContent = '✅ Generated (AI)';
          console.log('[VLA] Chapters generated using AI');
        }
        setTimeout(() => {
          btn.textContent = 'Regenerate Chapters';
        }, 2000);
      } else {
        container.innerHTML = '<p class="vla-error">Error: ' + (response?.error || 'Unknown error') + '</p>';
        btn.textContent = 'Try Again';
      }
    } catch (error) {
      console.error('[VLA] Generation error:', error);

      let errorMessage = 'Generation failed. ';
      if (error.message.includes('network')) {
        errorMessage += 'Check your internet connection.';
      } else if (error.message.includes('AI')) {
        errorMessage += 'AI service unavailable. Using fallback mode.';
      } else {
        errorMessage += 'Please try again.';
      }

      container.innerHTML = `
        <div class="vla-error-state">
          <p class="vla-error">${errorMessage}</p>
          <button class="vla-btn-secondary" onclick="location.reload()">Reload Page</button>
        </div>
      `;
      btn.textContent = 'Try Again';
    } finally {
      isProcessing = false;
      btn.disabled = false;
    }
  }

  displayChapters(chapters, usedFallback = false) {
    const container = document.getElementById('vla-chapters-container');
    if (!container || !Array.isArray(chapters)) return;

    if (chapters.length === 0) {
      container.innerHTML = '<p class="vla-loading">No chapters generated</p>';
      return;
    }

    // Calculate chapter quality score
    const quality = this.assessChapterQuality(chapters);
    const qualityBadge = this.getQualityBadge(quality);
    
    // Add fallback indicator if used
    const fallbackBadge = usedFallback ? 
      '<span class="vla-fallback-badge" title="Generated without AI">⚙️ Fallback Mode</span>' : '';

    container.innerHTML = `
      <div class="vla-chapters-header">
        <span class="vla-chapter-count">${chapters.length} chapters ${qualityBadge} ${fallbackBadge}</span>
        <div class="vla-chapter-actions">
          <button id="vla-export-btn" class="vla-btn-export" title="Export chapters">
            📥 Export
          </button>
          <button id="vla-copy-btn" class="vla-btn-export" title="Copy to clipboard">
            📋 Copy
          </button>
        </div>
      </div>
      ${chapters.map((ch, i) => `
        <div class="vla-chapter-item" data-timestamp="${ch.timestampSeconds || 0}" data-index="${i}">
          <div class="vla-chapter-header">
            <strong>${ch.title || 'Chapter ' + (i + 1)}</strong>
            <span class="vla-chapter-time">${ch.timestamp || '0:00'}</span>
          </div>
          <p class="vla-chapter-summary">${ch.summary || ''}</p>
        </div>
      `).join('')}
    `;

    // Add click handlers for seeking
    this.setupChapterClickHandlers();

    // Add export handler
    document.getElementById('vla-export-btn')?.addEventListener('click', () => this.exportChapters());

    // Add copy handler
    document.getElementById('vla-copy-btn')?.addEventListener('click', () => this.copyChaptersToClipboard());
  }

  assessChapterQuality(chapters) {
    let score = 0;

    // Check number of chapters (optimal: 5-10)
    if (chapters.length >= 5 && chapters.length <= 10) score += 30;
    else if (chapters.length >= 3 && chapters.length <= 15) score += 20;
    else score += 10;

    // Check if titles are meaningful (not generic)
    const meaningfulTitles = chapters.filter(ch =>
      ch.title &&
      !ch.title.match(/^(Section|Chapter|Part)\s+\d+$/i) &&
      ch.title.length > 10
    ).length;
    score += (meaningfulTitles / chapters.length) * 30;

    // Check if summaries exist and are substantial
    const goodSummaries = chapters.filter(ch =>
      ch.summary && ch.summary.length > 50
    ).length;
    score += (goodSummaries / chapters.length) * 20;

    // Check timestamp distribution
    const timestamps = chapters.map(ch => ch.timestampSeconds || 0);
    const isWellDistributed = timestamps.every((t, i) =>
      i === 0 || t > timestamps[i - 1]
    );
    if (isWellDistributed) score += 20;

    return Math.round(score);
  }

  getQualityBadge(score) {
    if (score >= 80) return '<span class="vla-quality-badge vla-quality-excellent">✨ Excellent</span>';
    if (score >= 60) return '<span class="vla-quality-badge vla-quality-good">✅ Good</span>';
    if (score >= 40) return '<span class="vla-quality-badge vla-quality-fair">⚠️ Fair</span>';
    return '<span class="vla-quality-badge vla-quality-basic">📝 Basic</span>';
  }

  copyChaptersToClipboard() {
    if (!chapterData || chapterData.length === 0) {
      alert('No chapters to copy');
      return;
    }

    // Format chapters as text
    const text = chapterData.map((ch, i) =>
      `${ch.timestamp} - ${ch.title}\n${ch.summary || ''}`
    ).join('\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      console.log('[VLA] Chapters copied to clipboard');

      // Visual feedback
      const btn = document.getElementById('vla-copy-btn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
    }).catch(err => {
      console.error('[VLA] Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  setupChapterClickHandlers() {
    const chapterItems = document.querySelectorAll('.vla-chapter-item');
    chapterItems.forEach(item => {
      item.addEventListener('click', () => {
        const timestamp = parseFloat(item.dataset.timestamp);
        const index = parseInt(item.dataset.index);
        this.seekToChapter(timestamp, index);
      });
    });
  }

  seekToChapter(timestamp, index) {
    if (!this.video) {
      console.error('[VLA] No video element found');
      return;
    }

    // Seek to timestamp
    this.video.currentTime = timestamp;

    // Play if paused
    if (this.video.paused) {
      this.video.play();
    }

    // Visual feedback
    const items = document.querySelectorAll('.vla-chapter-item');
    items.forEach(item => item.classList.remove('vla-chapter-active'));
    items[index]?.classList.add('vla-chapter-active');

    console.log(`[VLA] Seeking to chapter ${index + 1} at ${timestamp}s`);
  }

  setupClickToExplain() {
    if (!this.video) return;

    console.log('[VLA] Setting up click-to-explain on video');

    // Use double-click to avoid interfering with normal video controls
    this.video.addEventListener('dblclick', async (e) => {
      console.log('[VLA] Video double-clicked');
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX;
      const y = e.clientY;

      await this.showExplanationTooltip(x, y);
    });

    // Also add keyboard shortcut Alt+E for explain
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        const rect = this.video.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        this.showExplanationTooltip(x, y);
      }
    });
  }

  async showExplanationTooltip(x, y) {
    console.log('[VLA] Showing explanation tooltip at', x, y);

    // Remove existing tooltip
    const existing = document.getElementById('vla-explain-tooltip');
    if (existing) existing.remove();

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'vla-explain-tooltip';
    tooltip.className = 'vla-explain-tooltip';
    tooltip.style.left = x + 'px';
    tooltip.style.top = (y - 150) + 'px';
    tooltip.innerHTML = `
      <div class="vla-explain-header">
        <div class="vla-spinner-small"></div>
        <span>AI Explanation</span>
      </div>
      <div class="vla-explain-body">Analyzing this moment...</div>
      <div class="vla-explain-footer">Powered by Prompt API</div>
    `;
    document.body.appendChild(tooltip);

    // Get explanation from AI with video frame
    try {
      const currentTime = this.video.currentTime;
      const timestamp = this.formatTime(currentTime);

      console.log('[VLA] Current time:', timestamp);

      // Capture current video frame
      const frameData = await this.captureVideoFrame();
      console.log('[VLA] Frame captured:', frameData ? 'Yes' : 'No');

      // Find relevant chapter
      const currentChapter = chapterData.find((ch, i) => {
        const nextCh = chapterData[i + 1];
        return currentTime >= ch.timestampSeconds &&
          (!nextCh || currentTime < nextCh.timestampSeconds);
      });

      const context = currentChapter ?
        `At ${timestamp}, in the chapter "${currentChapter.title}": ${currentChapter.summary}` :
        `At ${timestamp} in the video: ${videoMetadata.title || 'Video content'}`;

      console.log('[VLA] Context:', context);

      const explanation = await this.getAIExplanation(context, frameData);
      console.log('[VLA] Explanation received:', explanation);

      const bodyEl = tooltip.querySelector('.vla-explain-body');
      if (bodyEl) {
        bodyEl.textContent = explanation;
      }
    } catch (error) {
      console.error('[VLA] Explanation error:', error);
      const bodyEl = tooltip.querySelector('.vla-explain-body');
      if (bodyEl) {
        bodyEl.textContent = 'Unable to generate explanation. Try generating chapters first or check if AI is available.';
      }
    }

    // Auto-dismiss after 8 seconds (longer to read)
    setTimeout(() => {
      if (tooltip.parentElement) {
        tooltip.remove();
      }
    }, 8000);
  }

  async captureVideoFrame() {
    try {
      if (!this.video) return null;

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = this.video.videoWidth || 640;
      canvas.height = this.video.videoHeight || 360;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl;
    } catch (error) {
      console.error('[VLA] Frame capture error:', error);
      return null;
    }
  }

  async getAIExplanation(context, frameData) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'explainMoment',
            context: context,
            transcript: transcriptText.substring(0, 1000),
            frameData: frameData // Send captured frame
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });

      return response?.explanation || 'At this moment in the video, the content is being presented.';
    } catch (error) {
      console.error('[VLA] AI explanation error:', error);
      return 'Unable to generate explanation.';
    }
  }

  async displayTranscript() {
    const container = document.getElementById('vla-transcript-container');
    if (!container) return;

    container.innerHTML = '<div class="vla-loading-state"><div class="vla-spinner"></div><p>Loading transcript...</p></div>';

    // Try to get real captions first (YouTube only for now)
    let captions = null;
    if (this.platform === 'youtube') {
      captions = await this.extractYouTubeCaptions();
    }

    if (captions && captions.length > 0) {
      // Use real captions with actual timestamps
      container.innerHTML = captions.map(cap => `
        <div class="vla-transcript-segment">
          <span class="vla-transcript-time" data-time="${cap.timeSeconds || 0}">${cap.time}</span>
          <span class="vla-transcript-text">${cap.text}</span>
        </div>
      `).join('');
    } else if (transcriptText && transcriptText.length >= 50) {
      // Fallback: estimate timestamps from transcript text
      const segments = [];
      const sentences = transcriptText.match(/[^.!?]+[.!?]+/g) || [transcriptText];

      let currentSegment = '';
      let currentTime = 0;
      const timeIncrement = (this.video?.duration || 600) / sentences.length;

      sentences.forEach((sentence, i) => {
        currentSegment += sentence + ' ';

        if (currentSegment.length > 200 || i === sentences.length - 1) {
          segments.push({
            time: currentTime,
            text: currentSegment.trim()
          });
          currentSegment = '';
        }

        currentTime += timeIncrement;
      });

      container.innerHTML = segments.map(seg => `
        <div class="vla-transcript-segment">
          <span class="vla-transcript-time" data-time="${seg.time}">${this.formatTime(seg.time)}</span>
          <span class="vla-transcript-text">${seg.text}</span>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="vla-loading">No transcript available</p>';
      return;
    }

    // Add click handlers
    container.querySelectorAll('.vla-transcript-time').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseFloat(el.dataset.time);
        if (this.video) {
          this.video.currentTime = time;
          if (this.video.paused) this.video.play();
        }
      });
    });
  }

  async displayRecommendations() {
    const container = document.getElementById('vla-recommendations-container');
    if (!container) return;

    if (!chapterData || chapterData.length === 0) {
      container.innerHTML = '<p class="vla-loading">Generate chapters first to see recommendations</p>';
      return;
    }

    container.innerHTML = '<div class="vla-loading-state"><div class="vla-spinner"></div><p>Generating recommendations...</p></div>';

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'generateRecommendations',
            chapters: chapterData,
            metadata: videoMetadata
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response && response.success && response.recommendations) {
        const recommendations = response.recommendations;
        
        container.innerHTML = recommendations.map(rec => `
          <div class="vla-recommendation-card">
            <div class="vla-recommendation-content">
              <h5>${rec.title}</h5>
              <p class="vla-recommendation-description">${rec.description}</p>
              <div class="vla-recommendation-meta">
                <span class="vla-recommendation-platform">${rec.platform}</span>
                <span class="vla-recommendation-type">${rec.type}</span>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="vla-error">Unable to generate recommendations</p>';
      }
    } catch (error) {
      console.error('[VLA] Recommendations error:', error);
      container.innerHTML = '<p class="vla-error">Error generating recommendations</p>';
    }
  }

  async generateQuiz() {
    if (!chapterData || chapterData.length === 0) {
      alert('Please generate chapters first');
      return;
    }

    const container = document.getElementById('vla-quiz-container');
    const btn = document.getElementById('vla-generate-quiz-btn');

    btn.disabled = true;
    btn.textContent = '🤖 Generating...';

    container.innerHTML = `
      <div class="vla-loading-state">
        <div class="vla-spinner"></div>
        <p>AI is creating quiz questions...</p>
      </div>
    `;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'generateQuiz',
            chapters: chapterData,
            transcript: transcriptText
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response?.success && response.questions) {
        this.displayQuiz(response.questions);
        btn.textContent = '✅ Generated!';
      } else {
        container.innerHTML = '<p class="vla-error">Failed to generate quiz</p>';
        btn.textContent = 'Try Again';
      }
    } catch (error) {
      console.error('[VLA] Quiz generation error:', error);

      container.innerHTML = `
        <div class="vla-error-state">
          <p class="vla-error">Quiz generation failed. AI may be unavailable.</p>
          <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">
            Try generating chapters again or reload the page.
          </p>
        </div>
      `;
      btn.textContent = 'Try Again';
    } finally {
      btn.disabled = false;
    }
  }

  displayQuiz(questions) {
    const container = document.getElementById('vla-quiz-container');
    if (!container || !Array.isArray(questions)) return;

    let currentQuestion = 0;
    let score = 0;
    let answered = false;
    let answers = []; // Track all answers for review

    const getDifficultyBadge = (difficulty) => {
      const badges = {
        easy: '<span class="vla-difficulty-badge vla-difficulty-easy">Easy</span>',
        medium: '<span class="vla-difficulty-badge vla-difficulty-medium">Medium</span>',
        hard: '<span class="vla-difficulty-badge vla-difficulty-hard">Hard</span>'
      };
      return badges[difficulty] || badges.medium;
    };

    const renderQuestion = () => {
      const q = questions[currentQuestion];
      const progress = ((currentQuestion + 1) / questions.length) * 100;

      container.innerHTML = `
        <div class="vla-quiz-progress">
          <div class="vla-quiz-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="vla-quiz-header-row">
          <div class="vla-quiz-counter">Question ${currentQuestion + 1} of ${questions.length}</div>
          ${q.difficulty ? getDifficultyBadge(q.difficulty) : ''}
        </div>
        <div class="vla-quiz-question">
          <h5>${q.question}</h5>
          <div class="vla-quiz-options">
            ${q.options.map((opt, i) => `
              <button class="vla-quiz-option" data-index="${i}">
                <span class="vla-option-letter">${String.fromCharCode(65 + i)}</span>
                <span class="vla-option-text">${opt}</span>
              </button>
            `).join('')}
          </div>
          <div class="vla-quiz-explanation" style="display:none;">
            <div class="vla-quiz-feedback"></div>
            <h6>💡 Explanation</h6>
            <p>${q.explanation}</p>
            ${q.timestamp ? `<a href="#" class="vla-quiz-review" data-time="${q.timestampSeconds}">📺 Review at ${q.timestamp}</a>` : ''}
          </div>
          <button class="vla-quiz-next" style="display:none;">Next Question →</button>
        </div>
      `;

      answered = false;

      // Add option click handlers
      container.querySelectorAll('.vla-quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          answered = true;

          const selectedIndex = parseInt(btn.dataset.index);
          const isCorrect = selectedIndex === q.correctIndex;

          // Track answer
          answers.push({
            question: q.question,
            correct: isCorrect,
            selectedIndex,
            correctIndex: q.correctIndex
          });

          // Disable all buttons
          container.querySelectorAll('.vla-quiz-option').forEach(b => {
            b.style.pointerEvents = 'none';
          });

          if (isCorrect) {
            score++;
            btn.classList.add('vla-quiz-correct');
            // Show positive feedback
            const feedback = container.querySelector('.vla-quiz-feedback');
            feedback.innerHTML = '<div class="vla-feedback-correct">✅ Correct! Well done!</div>';
          } else {
            btn.classList.add('vla-quiz-incorrect');
            // Show correct answer
            const correctBtn = container.querySelectorAll('.vla-quiz-option')[q.correctIndex];
            if (correctBtn) {
              correctBtn.classList.add('vla-quiz-correct');
            }
            // Show corrective feedback
            const feedback = container.querySelector('.vla-quiz-feedback');
            feedback.innerHTML = `<div class="vla-feedback-incorrect">❌ Not quite. The correct answer is ${String.fromCharCode(65 + q.correctIndex)}.</div>`;
          }

          // Show explanation with animation
          const explanation = container.querySelector('.vla-quiz-explanation');
          explanation.style.display = 'block';
          setTimeout(() => {
            explanation.classList.add('vla-fade-in');
          }, 10);

          // Show next button or finish
          if (currentQuestion < questions.length - 1) {
            container.querySelector('.vla-quiz-next').style.display = 'block';
          } else {
            setTimeout(() => showResults(), 2000);
          }
        });
      });

      // Next button handler
      container.querySelector('.vla-quiz-next')?.addEventListener('click', () => {
        currentQuestion++;
        renderQuestion();
      });

      // Review link handler
      container.querySelector('.vla-quiz-review')?.addEventListener('click', (e) => {
        e.preventDefault();
        const time = parseFloat(e.target.dataset.time);
        if (this.video) {
          this.video.currentTime = time;
          if (this.video.paused) this.video.play();
        }
      });
    };

    const showResults = () => {
      const percentage = Math.round((score / questions.length) * 100);

      // Determine grade and message
      let grade, message, emoji;
      if (percentage >= 90) {
        grade = 'A+';
        message = 'Outstanding! You mastered this content!';
        emoji = '🏆';
      } else if (percentage >= 80) {
        grade = 'A';
        message = 'Excellent work! You have a strong understanding!';
        emoji = '🎉';
      } else if (percentage >= 70) {
        grade = 'B';
        message = 'Good job! You understand most concepts!';
        emoji = '👍';
      } else if (percentage >= 60) {
        grade = 'C';
        message = 'Not bad! Review the material to improve!';
        emoji = '📚';
      } else {
        grade = 'D';
        message = 'Keep learning! Review the chapters and try again!';
        emoji = '💪';
      }

      // Build review section
      const reviewHTML = answers.map((ans, i) => `
        <div class="vla-answer-review ${ans.correct ? 'correct' : 'incorrect'}">
          <div class="vla-review-header">
            <span class="vla-review-number">Q${i + 1}</span>
            <span class="vla-review-status">${ans.correct ? '✅' : '❌'}</span>
          </div>
          <div class="vla-review-question">${ans.question}</div>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="vla-quiz-results">
          <div class="vla-results-header">
            <h4>Quiz Complete! ${emoji}</h4>
            <div class="vla-grade-badge">${grade}</div>
          </div>
          
          <div class="vla-results-stats">
            <div class="vla-stat">
              <div class="vla-stat-value">${score}</div>
              <div class="vla-stat-label">Correct</div>
            </div>
            <div class="vla-stat">
              <div class="vla-stat-value">${questions.length - score}</div>
              <div class="vla-stat-label">Incorrect</div>
            </div>
            <div class="vla-stat">
              <div class="vla-stat-value">${percentage}%</div>
              <div class="vla-stat-label">Score</div>
            </div>
          </div>
          
          <p class="vla-results-message">${message}</p>
          
          <div class="vla-results-review">
            <h5>📊 Answer Review</h5>
            ${reviewHTML}
          </div>
          
          <div class="vla-results-actions">
            <button class="vla-btn-primary" id="vla-retake-quiz">🔄 Retake Quiz</button>
            <button class="vla-btn-secondary" id="vla-review-chapters">📚 Review Chapters</button>
          </div>
        </div>
      `;

      // Add event listeners
      document.getElementById('vla-retake-quiz')?.addEventListener('click', () => {
        currentQuestion = 0;
        score = 0;
        answers = [];
        renderQuestion();
      });

      document.getElementById('vla-review-chapters')?.addEventListener('click', () => {
        this.switchTab('chapters');
      });
    };

    renderQuestion();
  }

  async extractYouTubeCaptions() {
    // Try to get real YouTube captions with timestamps
    try {
      // Method 1: Try to get captions from ytInitialPlayerResponse
      const scriptTags = document.querySelectorAll('script');
      for (const script of scriptTags) {
        const content = script.textContent;
        if (content.includes('captionTracks')) {
          const match = content.match(/"captionTracks":(\[.*?\])/);
          if (match) {
            const tracks = JSON.parse(match[1]);
            if (tracks.length > 0) {
              // Prefer English captions, or first available
              let captionTrack = tracks.find(t =>
                t.languageCode === 'en' ||
                t.languageCode?.startsWith('en')
              ) || tracks[0];

              const captionUrl = captionTrack.baseUrl;
              console.log('[VLA] Fetching captions from:', captionUrl.substring(0, 100));

              const response = await fetch(captionUrl);
              if (!response.ok) {
                console.error('[VLA] Caption fetch failed:', response.status);
                return null;
              }

              const xmlText = await response.text();
              return this.parseYouTubeCaptionXML(xmlText);
            }
          }
        }
      }

      // Method 2: Try to get from transcript panel if open
      const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
      if (transcriptSegments.length > 0) {
        const captions = [];
        transcriptSegments.forEach(seg => {
          const timeEl = seg.querySelector('.segment-timestamp');
          const textEl = seg.querySelector('.segment-text, yt-formatted-string');
          if (timeEl && textEl) {
            const timeText = timeEl.textContent.trim();
            const text = textEl.textContent.trim();

            // Parse time to seconds
            const timeParts = timeText.split(':').map(p => parseInt(p) || 0);
            let timeSeconds = 0;
            if (timeParts.length === 3) {
              timeSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
            } else if (timeParts.length === 2) {
              timeSeconds = timeParts[0] * 60 + timeParts[1];
            }

            captions.push({
              time: timeText,
              timeSeconds: timeSeconds,
              text: text
            });
          }
        });
        if (captions.length > 0) {
          console.log('[VLA] ✅ Extracted', captions.length, 'captions from transcript panel');
          return captions;
        }
      }

      return null;
    } catch (error) {
      console.error('[VLA] Caption extraction error:', error);
      return null;
    }
  }

  parseYouTubeCaptionXML(xmlText) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const textElements = xmlDoc.querySelectorAll('text');

      const captions = [];
      textElements.forEach(el => {
        const start = parseFloat(el.getAttribute('start') || 0);
        const text = el.textContent;
        const minutes = Math.floor(start / 60);
        const seconds = Math.floor(start % 60);
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

        captions.push({
          time: timeStr,
          timeSeconds: start,
          text: text
        });
      });

      return captions;
    } catch (error) {
      console.error('[VLA] XML parsing error:', error);
      return null;
    }
  }

  exportChapters() {
    if (!chapterData || chapterData.length === 0) {
      alert('No chapters to export');
      return;
    }

    const exportData = {
      video: videoMetadata,
      chapters: chapterData,
      transcriptLength: transcriptText.length,
      quality: this.assessChapterQuality(chapterData),
      generatedAt: new Date().toISOString(),
      extension: 'Video Learning Accelerator v1.0'
    };

    // Save to Chrome storage for persistence
    this.saveChaptersToStorage(exportData);

    // Create downloadable file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chapters-${videoMetadata.title.substring(0, 50).replace(/[^a-z0-9]/gi, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[VLA] Chapters exported and saved');
  }

  saveChaptersToStorage(data) {
    const videoId = this.getVideoId();
    if (!videoId) return;

    const storageKey = `chapters_${videoId}`;
    const storageData = {
      [storageKey]: {
        ...data,
        savedAt: new Date().toISOString()
      }
    };

    chrome.storage.local.set(storageData, () => {
      if (chrome.runtime.lastError) {
        console.error('[VLA] Failed to save chapters:', chrome.runtime.lastError);
      } else {
        console.log('[VLA] 💾 Chapters saved to storage for video:', videoId);
      }
    });
  }

  loadChaptersFromStorage() {
    const videoId = this.getVideoId();
    if (!videoId) return;

    const storageKey = `chapters_${videoId}`;

    chrome.storage.local.get([storageKey], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[VLA] Failed to load chapters:', chrome.runtime.lastError);
        return;
      }

      const savedData = result[storageKey];
      if (savedData && savedData.chapters && savedData.chapters.length > 0) {
        console.log('[VLA] 📂 Found saved chapters for this video');
        chapterData = savedData.chapters;
        videoMetadata = savedData.video || videoMetadata;

        // Display the saved chapters
        this.displayChapters(chapterData);

        // Update button text
        const btn = document.getElementById('vla-generate-btn');
        if (btn) {
          btn.textContent = 'Regenerate Chapters';
        }

        // Show notification
        const container = document.getElementById('vla-chapters-container');
        if (container) {
          const notice = document.createElement('div');
          notice.className = 'vla-saved-notice';
          notice.innerHTML = '💾 Loaded previously generated chapters';
          container.insertBefore(notice, container.firstChild);
          setTimeout(() => notice.remove(), 5000);
        }
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.videoAcceleratorInstance = new VideoAccelerator();
  });
} else {
  window.videoAcceleratorInstance = new VideoAccelerator();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt+C: Toggle sidebar
  if (e.altKey && e.key === 'c') {
    e.preventDefault();
    const sidebar = document.getElementById('vla-sidebar');
    if (sidebar) {
      sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    }
  }

  // Alt+G: Generate chapters
  if (e.altKey && e.key === 'g') {
    e.preventDefault();
    const btn = document.getElementById('vla-generate-btn');
    if (btn && !btn.disabled) {
      btn.click();
    }
  }

  // Alt+E: Export chapters
  if (e.altKey && e.key === 'e') {
    e.preventDefault();
    const exportBtn = document.getElementById('vla-export-btn');
    if (exportBtn) {
      exportBtn.click();
    }
  }
});

// Message handler for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      hasChapters: chapterData.length > 0,
      chapterCount: chapterData.length,
      videoDetected: !!document.querySelector('video'),
      transcriptLength: transcriptText.length
    });
    return true;
  }

  if (request.action === 'generateChapters') {
    const accelerator = window.videoAcceleratorInstance;
    if (accelerator) {
      accelerator.generateChapters();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Extension not initialized' });
    }
    return true;
  }
});

// Debug helper
window.vlaDebug = () => {
  console.log({
    transcript: transcriptText.substring(0, 200),
    chapters: chapterData,
    video: currentVideo,
    metadata: videoMetadata
  });
};