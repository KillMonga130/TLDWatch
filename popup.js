/**
 * Popup Script - Video Learning Accelerator
 * Handles popup UI and AI status checking
 */

console.log('[Popup] Loaded');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const aiStatusText = document.getElementById('ai-status-text');

// Initialize
checkStatus();
checkAIStatus();

async function checkStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    console.log('[Popup] Current tab:', tab.url);

    // Check if tab is supported
    const isSupportedPlatform = tab.url.includes('youtube.com') || 
                                 tab.url.includes('coursera.org') || 
                                 tab.url.includes('udemy.com') || 
                                 tab.url.includes('linkedin.com/learning');

    if (!isSupportedPlatform) {
      statusDot.style.backgroundColor = '#ef4444';
      statusText.textContent = 'Not on video platform';
      return;
    }

    // Extension is active on supported platform
    statusDot.style.backgroundColor = '#10b981';
    statusText.textContent = 'Ready';
  } catch (error) {
    console.error('[Popup] Error:', error);
    statusDot.style.backgroundColor = '#ef4444';
    statusText.textContent = 'Error';
  }
}

async function checkAIStatus() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'checkAICapabilities' },
        (resp) => resolve(resp)
      );
    });

    if (response?.success && response.capabilities?.available) {
      aiStatusText.innerHTML = '✅ <strong>AI Ready</strong><br><small>Gemini Nano available</small>';
      aiStatusText.style.color = '#10b981';
    } else {
      const status = response?.capabilities?.status || 'unavailable';
      aiStatusText.innerHTML = `⚠️ <strong>AI ${status}</strong><br><small>Using fallback mode</small>`;
      aiStatusText.style.color = '#f59e0b';
    }
  } catch (error) {
    console.error('[Popup] AI check error:', error);
    aiStatusText.innerHTML = '❌ <strong>AI Unavailable</strong><br><small>Using fallback mode</small>';
    aiStatusText.style.color = '#ef4444';
  }
}
