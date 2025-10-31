/**
 * Popup Script
 * Handles popup UI and messaging
 */

console.log('[Popup] Loaded');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toggleBtn = document.getElementById('toggle-extension');
const generateBtn = document.getElementById('generate-btn');
const infoContainer = document.getElementById('info-container');
const debugBtn = document.getElementById('debug-btn');

// Initialize
checkStatus();

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
      statusText.textContent = 'Not a supported platform';
      infoContainer.innerHTML = '<p style="color: #666;">Visit YouTube, Coursera, Udemy, or LinkedIn Learning</p>';
      toggleBtn.disabled = true;
      generateBtn.disabled = true;
      return;
    }

    // Check settings
    const settings = await chrome.storage.local.get(['extensionEnabled']);
    const isEnabled = settings.extensionEnabled !== false;

    if (isEnabled) {
      statusDot.style.backgroundColor = '#10b981';
      statusText.textContent = 'Active';
    } else {
      statusDot.style.backgroundColor = '#f59e0b';
      statusText.textContent = 'Disabled';
    }

    updateInfo();
  } catch (error) {
    console.error('[Popup] Error:', error);
    statusDot.style.backgroundColor = '#ef4444';
    statusText.textContent = 'Error';
  }
}

async function updateInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    // Send message to content script to get status
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        infoContainer.innerHTML = `
          <p><strong>✓</strong> Extension active on this page</p>
          <p><strong>→</strong> Open sidebar to generate chapters</p>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">Keyboard shortcuts:</p>
          <p style="font-size: 11px; color: #666;">Alt+C: Toggle sidebar</p>
          <p style="font-size: 11px; color: #666;">Alt+G: Generate chapters</p>
          <p style="font-size: 11px; color: #666;">Alt+E: Export chapters</p>
        `;
      } else {
        const { hasChapters, chapterCount, videoDetected } = response;
        infoContainer.innerHTML = `
          <p><strong>Video:</strong> ${videoDetected ? '✓ Detected' : '✗ Not found'}</p>
          <p><strong>Chapters:</strong> ${hasChapters ? `${chapterCount} generated` : 'None yet'}</p>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">Keyboard shortcuts:</p>
          <p style="font-size: 11px; color: #666;">Alt+C: Toggle sidebar</p>
          <p style="font-size: 11px; color: #666;">Alt+G: Generate</p>
          <p style="font-size: 11px; color: #666;">Alt+E: Export</p>
        `;
      }
    });
  } catch (error) {
    console.error('[Popup] Error updating info:', error);
    infoContainer.innerHTML = `
      <p><strong>✓</strong> Extension active</p>
      <p style="font-size: 12px; color: #666;">Open sidebar on video page</p>
    `;
  }
}

toggleBtn.addEventListener('click', async () => {
  const settings = await chrome.storage.local.get(['extensionEnabled']);
  const newState = !(settings.extensionEnabled !== false);
  await chrome.storage.local.set({ extensionEnabled: newState });
  checkStatus();
});

generateBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tabs[0].id, { action: 'generateChapters' }, (response) => {
    if (chrome.runtime.lastError) {
      infoContainer.innerHTML = '<p style="color: #ef4444;">Error: Extension not ready on this page</p>';
    } else {
      infoContainer.innerHTML = '<p style="color: #10b981;">✓ Check the sidebar for chapters!</p>';
    }
  });
});

debugBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('[Popup] Debug info:', {
      tab: tabs[0].url,
      timestamp: new Date().toLocaleTimeString()
    });
    infoContainer.innerHTML = '<p>Debug info logged to console</p>';
  });
});
