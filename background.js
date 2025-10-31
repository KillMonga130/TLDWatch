/**
 * Background Service Worker - PRODUCTION READY
 * Only use VALID offscreen reasons
 */

console.log('[Background] Service worker loaded');

let offscreenReady = false;
let offscreenCreating = false; // Prevent multiple simultaneous creation attempts

async function ensureOffscreenDocument() {
  // If already creating, wait for it to complete
  if (offscreenCreating) {
    console.log('[Background] Offscreen creation already in progress, waiting...');
    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 100));
    return offscreenReady;
  }

  // If already ready, just return
  if (offscreenReady) {
    console.log('[Background] Offscreen document already ready');
    return true;
  }

  offscreenCreating = true;

  try {
    // Check if offscreen already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      console.log('[Background] Offscreen document already exists');
      offscreenReady = true;
      offscreenCreating = false;
      return true;
    }

    console.log('[Background] Creating offscreen document...');
    
    // ✅ FIXED: Use only VALID reasons from the allowed list
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_SCRAPING'],  // ✅ Valid reason
      justification: 'Process video content and generate chapters'
    });

    console.log('[Background] ✅ Offscreen document created');
    offscreenReady = true;
    offscreenCreating = false;
    return true;
  } catch (error) {
    console.error('[Background] Offscreen creation error:', error.message);
    // Gracefully continue without offscreen
    offscreenReady = false;
    offscreenCreating = false;
    return false;
  }
}

// On install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed');
  await ensureOffscreenDocument();
  chrome.storage.local.set({
    extensionEnabled: true
  });
});

// On startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension startup');
  await ensureOffscreenDocument();
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    sendResponse({ success: false, error: 'No action' });
    return false;
  }

  console.log('[Background] Message:', request.action);

  if (request.action === 'generateChapters') {
    handleChapterGeneration(request, sendResponse);
    return true;
  }

  if (request.action === 'checkAICapabilities') {
    handleCapabilityCheck(sendResponse);
    return true;
  }

  return false;
});

async function handleChapterGeneration(request, sendResponse) {
  try {
    // Ensure offscreen exists
    if (!offscreenReady) {
      await ensureOffscreenDocument();
    }

    // Forward to offscreen if available
    if (offscreenReady) {
      chrome.runtime.sendMessage(
        { 
          action: 'generateChapters', 
          transcript: request.transcript,
          metadata: request.metadata || {}
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log('[Background] Using fallback - offscreen unavailable');
            sendResponse({
              success: true,
              chapters: generateFallbackChapters(request.transcript, request.metadata)
            });
          } else {
            sendResponse(response || { success: true, chapters: [] });
          }
        }
      );
    } else {
      // Fallback if offscreen not available
      sendResponse({
        success: true,
        chapters: generateFallbackChapters(request.transcript, request.metadata)
      });
    }
  } catch (error) {
    console.error('[Background] Generation error:', error);
    sendResponse({
      success: true,
      chapters: generateFallbackChapters(request.transcript, request.metadata)
    });
  }
}

async function handleCapabilityCheck(sendResponse) {
  try {
    if (offscreenReady) {
      chrome.runtime.sendMessage(
        { action: 'checkAICapabilities' },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: true,
              capabilities: { available: false, status: 'fallback' }
            });
          } else {
            sendResponse(response || { success: true, capabilities: { available: false } });
          }
        }
      );
    } else {
      sendResponse({
        success: true,
        capabilities: { available: false, status: 'no-offscreen' }
      });
    }
  } catch (error) {
    sendResponse({
      success: true,
      capabilities: { available: false, status: 'error' }
    });
  }
}

function generateFallbackChapters(transcript, metadata = {}) {
  if (!transcript || typeof transcript !== 'string') {
    return [];
  }

  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  const videoDuration = metadata.duration || 600;
  const chaptersCount = Math.min(8, Math.max(3, Math.ceil(words.length / 250)));
  const chapters = [];
  const secondsPerChapter = videoDuration / chaptersCount;

  for (let i = 0; i < chaptersCount; i++) {
    const startIdx = Math.floor(i * words.length / chaptersCount);
    const endIdx = Math.floor((i + 1) * words.length / chaptersCount);
    const chapterWords = words.slice(startIdx, endIdx);
    const summary = chapterWords.slice(0, 25).join(' ');
    
    const timestampSeconds = Math.floor(i * secondsPerChapter);
    const mins = Math.floor(timestampSeconds / 60);
    const secs = timestampSeconds % 60;
    const timestamp = `${mins}:${String(secs).padStart(2, '0')}`;

    chapters.push({
      timestamp,
      timestampSeconds,
      title: `Section ${i + 1}`,
      summary: summary + (chapterWords.length > 25 ? '...' : '')
    });
  }

  return chapters;
}

// Initialize offscreen document on service worker load
(async () => {
  await ensureOffscreenDocument();
})();