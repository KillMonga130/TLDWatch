# 🤖 Chrome AI Setup Guide

## Why You're Seeing "Fallback Mode"

The extension is using fallback mode because Chrome's Built-in AI (Gemini Nano) is not available. This means:
- ❌ AI is not generating intelligent chapters
- ❌ AI is not generating quiz questions
- ❌ AI is not providing explanations
- ✅ Basic rule-based fallback is working (simple text chunking)

---

## ✅ How to Enable Chrome AI (Required for Full Features)

### Step 1: Use Chrome Dev or Canary

**Download Chrome Dev or Canary**:
- Chrome Dev: https://www.google.com/chrome/dev/
- Chrome Canary: https://www.google.com/chrome/canary/

**Why?** Chrome Stable (regular Chrome) doesn't have Gemini Nano yet.

### Step 2: Enable Required Flags

1. Open Chrome Dev/Canary
2. Go to: `chrome://flags`
3. Search for and enable these flags:

**Flag 1: Prompt API for Gemini Nano**
```
chrome://flags/#prompt-api-for-gemini-nano
```
Set to: **Enabled**

**Flag 2: Optimization Guide On Device Model**
```
chrome://flags/#optimization-guide-on-device-model
```
Set to: **Enabled BypassPerfRequirement**

4. Click **Relaunch** button at bottom

### Step 3: Download Gemini Nano Model

1. After relaunch, open DevTools (F12)
2. Go to Console tab
3. Run this command:
```javascript
await ai.languageModel.create();
```

4. You should see a download progress indicator
5. Wait for download to complete (can take 5-10 minutes, ~1.7GB)

### Step 4: Verify AI is Working

1. In Console, run:
```javascript
const session = await ai.languageModel.create();
const result = await session.prompt("Say hello");
console.log(result);
```

2. If you see a response like "Hello! How can I help you?", AI is working!

### Step 5: Reload Extension

1. Go to `chrome://extensions/`
2. Find "Video Learning Accelerator"
3. Click the reload icon
4. Open a YouTube video
5. Generate chapters - should now say "✅ Generated (AI)" instead of "✅ Generated (Fallback)"

---

## 🔍 Troubleshooting

### Check 1: Verify Chrome Version
```
chrome://version/
```
Should be Chrome 127 or higher (Dev/Canary)

### Check 2: Check AI Status in Console
Open DevTools (F12) and run:
```javascript
console.log('AI available:', !!self.ai);
console.log('Language Model:', !!self.ai?.languageModel);
if (self.ai?.languageModel) {
  const status = await self.ai.languageModel.availability();
  console.log('Status:', status);
}
```

Expected output:
```
AI available: true
Language Model: true
Status: readily
```

### Check 3: Extension Console Logs
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "service worker" under Video Learning Accelerator
4. Look for these messages:
```
[Offscreen] AI availability status: readily
[Offscreen] ✅ Generated 8 AI chapters
```

If you see:
```
[Offscreen] AI not available, using fallback
[Offscreen] Using fallback chapter generation (no AI)
```
Then AI is not enabled properly.

---

## 🎯 Quick Test

After setup, test if AI is working:

1. Open YouTube video
2. Open extension sidebar
3. Click "Generate Chapters"
4. Check button text:
   - ✅ "Generated (AI)" = AI working!
   - ⚠️ "Generated (Fallback)" = AI not working

5. Check for badge:
   - No badge = AI working
   - "⚙️ Fallback Mode" badge = AI not working

---

## 📋 Common Issues

### Issue: "AI not available"
**Solution**: 
- Use Chrome Dev or Canary (not regular Chrome)
- Enable both flags
- Relaunch browser

### Issue: "Status: no"
**Solution**:
- Run `await ai.languageModel.create()` in console
- Wait for model download
- Can take 5-10 minutes

### Issue: "Status: after-download"
**Solution**:
- Model is downloading in background
- Wait a few minutes
- Check again with `await ai.languageModel.availability()`

### Issue: Still showing fallback
**Solution**:
1. Close all Chrome windows
2. Reopen Chrome Dev/Canary
3. Reload extension
4. Try again

---

## 🌍 Regional Availability

Chrome Built-in AI may not be available in all regions yet. If you've followed all steps and it still doesn't work:

1. Check if your region is supported
2. Try using a VPN to US/UK
3. Wait for Google to expand availability

---

## 💡 Alternative: Use Without AI

The extension still works in fallback mode:
- ✅ Generates chapters (simple text chunking)
- ✅ Transcript tab works
- ✅ Quiz tab works (basic questions)
- ✅ All navigation features work

It just won't be as intelligent as with AI.

---

## 📞 Still Not Working?

1. Check console for errors (F12)
2. Share the console output
3. Verify Chrome version
4. Confirm flags are enabled
5. Check if model downloaded

**Console command to check everything**:
```javascript
console.log('Chrome version:', navigator.userAgent);
console.log('AI available:', !!self.ai);
console.log('Language Model:', !!self.ai?.languageModel);
if (self.ai?.languageModel) {
  const status = await self.ai.languageModel.availability();
  console.log('AI Status:', status);
  if (status === 'readily') {
    console.log('✅ AI is ready!');
  } else {
    console.log('❌ AI not ready:', status);
  }
}
```

---

**Once AI is enabled, the extension will automatically use it for all features!**
