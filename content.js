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
    
    // Track video progress to highlight current chapter
    this.video.addEventListener('timeupdate', () => {
      this.updateCurrentChapter();
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
        <button id="vla-close" class="vla-btn-close">✕</button>
      </div>

      <div class="vla-tabs">
        <button class="vla-tab-btn active" data-tab="chapters">Chapters</button>
        <button class="vla-tab-btn" data-tab="status">Status</button>
      </div>

      <div class="vla-content">
        <div class="vla-tab-content active" id="chapters-tab">
          <div id="vla-chapters-container">
            <p class="vla-loading">No chapters yet. Click Generate to start.</p>
          </div>
          <button id="vla-generate-btn" class="vla-btn-primary">Generate Chapters</button>
        </div>

        <div class="vla-tab-content" id="status-tab">
          <div class="vla-status">
            <p><strong>Platform:</strong> ${this.platform}</p>
            <p><strong>Video Duration:</strong> ${this.formatTime(this.video?.duration || 0)}</p>
            <p id="vla-transcript-status">⏳ Extracting transcript...</p>
            <p id="vla-ai-status">⏳ Checking AI...</p>
            <button id="vla-debug-btn" class="vla-btn-secondary">Debug</button>
            <button id="vla-retry-transcript" class="vla-btn-secondary">Retry Transcript</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    this.sidebar = sidebar;

    // Event listeners
    document.getElementById('vla-close').addEventListener('click', () => this.sidebar.remove());
    document.getElementById('vla-generate-btn').addEventListener('click', () => this.generateChapters());
    
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

    document.getElementById('vla-retry-transcript')?.addEventListener('click', () => {
      console.log('[VLA] Manual transcript retry requested');
      extractionAttempts = 0;
      transcriptText = '';
      this.extractTranscript();
      alert('Retrying transcript extraction...');
    });

    this.checkAICapabilities();
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

      const statusEl = document.getElementById('vla-ai-status');
      if (statusEl) {
        // ✅ FIX: Add null safety check
        if (response && response.success && response.capabilities) {
          if (response.capabilities.available) {
            statusEl.innerHTML = '✅ AI Ready';
          } else {
            statusEl.innerHTML = `⚠️ AI: ${response.capabilities.status || 'Not available'}`;
          }
        } else {
          statusEl.innerHTML = '⚠️ AI not available in this region';
        }
      }
    } catch (error) {
      console.error('[VLA] AI check error:', error);
      const statusEl = document.getElementById('vla-ai-status');
      if (statusEl) {
        statusEl.innerHTML = '❌ AI Error';
      }
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
        this.displayChapters(response.chapters);
        
        // Show success message briefly
        btn.textContent = '✅ Generated!';
        setTimeout(() => {
          btn.textContent = 'Regenerate Chapters';
        }, 2000);
      } else {
        container.innerHTML = '<p class="vla-error">Error: ' + (response?.error || 'Unknown error') + '</p>';
        btn.textContent = 'Try Again';
      }
    } catch (error) {
      console.error('[VLA] Generation error:', error);
      container.innerHTML = '<p class="vla-error">Generation failed: ' + error.message + '</p>';
      btn.textContent = 'Try Again';
    } finally {
      isProcessing = false;
      btn.disabled = false;
    }
  }

  displayChapters(chapters) {
    const container = document.getElementById('vla-chapters-container');
    if (!container || !Array.isArray(chapters)) return;

    if (chapters.length === 0) {
      container.innerHTML = '<p class="vla-loading">No chapters generated</p>';
      return;
    }

    // Calculate chapter quality score
    const quality = this.assessChapterQuality(chapters);
    const qualityBadge = this.getQualityBadge(quality);

    container.innerHTML = `
      <div class="vla-chapters-header">
        <span class="vla-chapter-count">${chapters.length} chapters ${qualityBadge}</span>
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

  exportChapters() {
    if (!chapterData || chapterData.length === 0) {
      alert('No chapters to export');
      return;
    }
    
    const exportData = {
      video: videoMetadata,
      chapters: chapterData,
      generatedAt: new Date().toISOString(),
      extension: 'Video Learning Accelerator v1.0'
    };
    
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
    
    console.log('[VLA] Chapters exported');
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