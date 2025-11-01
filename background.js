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
    await new Promise(resolve => setTimeout(resolve, 250));
    return offscreenReady;
  }

  // If already ready, verify it still exists
  if (offscreenReady) {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      if (existingContexts.length > 0) {
        console.log('[Background] Offscreen document verified');
        return true;
      } else {
        console.log('[Background] Offscreen was ready but no longer exists, recreating...');
        offscreenReady = false;
      }
    } catch (error) {
      console.log('[Background] Error checking offscreen, will recreate:', error.message);
      offscreenReady = false;
    }
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
    
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_SCRAPING'],
      justification: 'Process video content and generate chapters with AI'
    });

    console.log('[Background] ✅ Offscreen document created');
    offscreenReady = true;
    offscreenCreating = false;
    
    // Wait a moment for offscreen to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('[Background] Offscreen creation error:', error.message);
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

  if (request.action === 'generateQuiz') {
    handleQuizGeneration(request, sendResponse);
    return true;
  }

  if (request.action === 'explainMoment') {
    handleExplanation(request, sendResponse);
    return true;
  }

  return false;
});

async function safeOffscreenCall(action, data, fallbackFn) {
  let retries = 0;
  const maxRetries = 2;
  
  while (retries < maxRetries) {
    try {
      // Ensure offscreen exists
      await ensureOffscreenDocument();
      
      if (!offscreenReady) {
        console.log('[Background] Offscreen not ready, using fallback');
        return fallbackFn();
      }
      
      // Make the call
      return await new Promise((resolve) => {
        chrome.runtime.sendMessage(data, (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message;
            console.error('[Background] Runtime error:', error);
            
            // Check if context was invalidated
            if (error.includes('Extension context invalidated') || 
                error.includes('message port closed')) {
              console.log('[Background] Context invalidated, will retry...');
              offscreenReady = false;
              resolve({ needsRetry: true });
            } else {
              resolve(fallbackFn());
            }
          } else {
            resolve(response || fallbackFn());
          }
        });
      });
    } catch (error) {
      console.error('[Background] Safe call error:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('[Background] Context invalidated, retrying...');
        offscreenReady = false;
        retries++;
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      return fallbackFn();
    }
    
    retries++;
  }
  
  console.log('[Background] Max retries reached, using fallback');
  return fallbackFn();
}

async function handleChapterGeneration(request, sendResponse) {
  try {
    const result = await safeOffscreenCall(
      'generateChapters',
      { 
        action: 'generateChapters', 
        transcript: request.transcript,
        metadata: request.metadata || {}
      },
      () => ({
        success: true,
        chapters: generateFallbackChapters(request.transcript, request.metadata),
        usedFallback: true
      })
    );
    
    if (result.needsRetry) {
      // Retry once more
      await new Promise(resolve => setTimeout(resolve, 250));
      const retryResult = await safeOffscreenCall(
        'generateChapters',
        { 
          action: 'generateChapters', 
          transcript: request.transcript,
          metadata: request.metadata || {}
        },
        () => ({
          success: true,
          chapters: generateFallbackChapters(request.transcript, request.metadata),
          usedFallback: true
        })
      );
      sendResponse(retryResult);
    } else {
      sendResponse(result);
    }
  } catch (error) {
    console.error('[Background] Generation error:', error);
    sendResponse({
      success: true,
      chapters: generateFallbackChapters(request.transcript, request.metadata),
      usedFallback: true
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

async function handleQuizGeneration(request, sendResponse) {
  try {
    const result = await safeOffscreenCall(
      'generateQuiz',
      { 
        action: 'generateQuiz', 
        chapters: request.chapters,
        transcript: request.transcript
      },
      () => ({
        success: true,
        questions: generateFallbackQuiz(request.chapters)
      })
    );
    
    if (result.needsRetry) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const retryResult = await safeOffscreenCall(
        'generateQuiz',
        { 
          action: 'generateQuiz', 
          chapters: request.chapters,
          transcript: request.transcript
        },
        () => ({
          success: true,
          questions: generateFallbackQuiz(request.chapters)
        })
      );
      sendResponse(retryResult);
    } else {
      sendResponse(result);
    }
  } catch (error) {
    console.error('[Background] Quiz generation error:', error);
    sendResponse({
      success: true,
      questions: generateFallbackQuiz(request.chapters)
    });
  }
}

async function handleExplanation(request, sendResponse) {
  try {
    const result = await safeOffscreenCall(
      'explainMoment',
      { 
        action: 'explainMoment', 
        context: request.context,
        transcript: request.transcript,
        frameData: request.frameData
      },
      () => ({
        success: true,
        explanation: request.context + '. The video is presenting this content.'
      })
    );
    
    if (result.needsRetry) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const retryResult = await safeOffscreenCall(
        'explainMoment',
        { 
          action: 'explainMoment', 
          context: request.context,
          transcript: request.transcript,
          frameData: request.frameData
        },
        () => ({
          success: true,
          explanation: request.context + '. The video is presenting this content.'
        })
      );
      sendResponse(retryResult);
    } else {
      sendResponse(result);
    }
  } catch (error) {
    console.error('[Background] Explanation error:', error);
    sendResponse({
      success: true,
      explanation: request.context + '. The video is presenting this content.'
    });
  }
}

function generateFallbackQuiz(chapters) {
  if (!chapters || chapters.length === 0) {
    return [];
  }

  const questions = [];
  
  chapters.slice(0, 5).forEach((ch, i) => {
    questions.push({
      question: `What is covered in the chapter "${ch.title}"?`,
      options: [
        ch.summary,
        'This topic is not covered in the video',
        'A different concept entirely',
        'None of the above'
      ],
      correctIndex: 0,
      explanation: `This chapter covers: ${ch.summary}`,
      timestamp: ch.timestamp,
      timestampSeconds: ch.timestampSeconds
    });
  });

  return questions;
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