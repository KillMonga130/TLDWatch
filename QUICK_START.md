# ⚡ Quick Start - Chrome Built-in AI Setup

## 5-Minute Setup Guide

### ✅ Step 1: Get Chrome Dev/Canary (2 min)

Download and install:
- **Chrome Dev**: https://www.google.com/chrome/dev/
- **Chrome Canary**: https://www.google.com/chrome/canary/

> ⚠️ Regular Chrome won't work - you need Dev or Canary!

---

### ✅ Step 2: Join Origin Trial (2 min)

1. Go to: https://developer.chrome.com/origintrials/
2. Search: "Writer API"
3. Click **Register**
4. Enter: `chrome-extension://YOUR_EXTENSION_ID`
   - Find your ID at `chrome://extensions/`
5. Copy the token
6. Open `manifest.json` in your extension
7. Replace `YOUR_ORIGIN_TRIAL_TOKEN_HERE` with your token:

```json
"trial_tokens": [
  "Paste your token here"
]
```

---

### ✅ Step 3: Enable Flags (1 min)

Copy and paste these URLs into Chrome, enable each one:

```
chrome://flags/#writer-api-for-gemini-nano
chrome://flags/#rewriter-api-for-gemini-nano
chrome://flags/#proofreader-api-for-gemini-nano
```

Set all to **Enabled**, then click **Relaunch** at the bottom.

---

### ✅ Step 4: Download Model (10 min)

1. After Chrome restarts, press **F12** (DevTools)
2. Go to **Console** tab
3. Paste and run:

```javascript
await Writer.create();
```

4. Wait for download (shows progress in console)
5. Check status at: `chrome://on-device-internals`

> 💾 Needs 22GB free storage and unmetered connection

---

### ✅ Step 5: Test Extension (1 min)

1. Go to `chrome://extensions/`
2. Click reload icon on your extension
3. Open a YouTube video
4. Click "Generate Chapters"
5. Should see: **"✅ Generated (AI)"**

---

## 🎯 Verify It's Working

### Quick Test in Console

Press F12 and run:

```javascript
// Check APIs
console.log('Writer:', 'Writer' in self);
console.log('Rewriter:', 'Rewriter' in self);
console.log('Proofreader:', 'Proofreader' in self);

// Check availability
const status = await Writer.availability();
console.log('Status:', status); // Should be 'readily'

// Quick test
const writer = await Writer.create({ tone: 'casual' });
const result = await writer.write('Say hello');
console.log('Result:', result);
writer.destroy();
```

Expected output:
```
Writer: true
Rewriter: true
Proofreader: true
Status: readily
Result: Hey there! How's it going?
```

---

## 🚨 Troubleshooting

### "Writer is not defined"
- ✅ Using Chrome Dev/Canary 137+?
- ✅ Flags enabled?
- ✅ Chrome restarted after enabling flags?

### "availability() returns 'no'"
- ✅ Origin trial token added to manifest?
- ✅ Token matches your extension ID?
- ✅ Token not expired?

### Model won't download
- ✅ 22GB free storage?
- ✅ On Wi-Fi (not cellular)?
- ✅ Try: `await Writer.create()` in console

### Extension shows "Fallback Mode"
- ✅ All above steps completed?
- ✅ Check console for error messages
- ✅ Reload extension after setup

---

## 📋 Checklist

Before using the extension:

- [ ] Chrome Dev/Canary 137+ installed
- [ ] Origin trial token in manifest.json
- [ ] Writer API flag enabled
- [ ] Rewriter API flag enabled
- [ ] Proofreader API flag enabled
- [ ] Chrome restarted
- [ ] Model downloaded (22GB)
- [ ] `Writer.availability()` returns 'readily'
- [ ] Extension reloaded
- [ ] Tested on YouTube video

---

## 🎉 Success!

If you see this in the extension:
- ✅ "Generated (AI)" button text
- ✅ No "Fallback Mode" badge
- ✅ Intelligent, well-structured chapters
- ✅ Relevant quiz questions

**You're all set!** 🚀

---

## 📚 More Help

- **Detailed Setup**: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **API Reference**: [API_REFERENCE.md](API_REFERENCE.md)
- **Test Page**: Open `test-ai-apis.html` in browser
- **Implementation**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## 🔗 Quick Links

- Chrome Dev: https://www.google.com/chrome/dev/
- Origin Trials: https://developer.chrome.com/origintrials/
- Writer API Docs: https://developer.chrome.com/docs/ai/writer-api
- Rewriter API Docs: https://developer.chrome.com/docs/ai/rewriter-api
- Model Status: chrome://on-device-internals

---

**Total Setup Time: ~15 minutes** (including model download)

Once setup is complete, everything works offline! 🎯
