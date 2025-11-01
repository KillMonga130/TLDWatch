/**
 * Quick Test Script for Quiz Functionality
 * 
 * HOW TO USE:
 * 1. Open YouTube video
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Follow the prompts
 */

console.log('🧪 Starting Quiz Functionality Test...\n');

// Test 1: Check if extension is loaded
console.log('Test 1: Extension Loaded');
const sidebar = document.getElementById('vla-sidebar');
if (sidebar) {
  console.log('✅ PASS: Sidebar found');
} else {
  console.log('❌ FAIL: Sidebar not found');
  console.log('   → Extension may not be loaded');
  console.log('   → Try refreshing the page');
}

// Test 2: Check if chapters exist
console.log('\nTest 2: Chapters Data');
if (typeof chapterData !== 'undefined' && chapterData.length > 0) {
  console.log('✅ PASS: Chapters exist:', chapterData.length, 'chapters');
  console.log('   First chapter:', chapterData[0].title);
} else {
  console.log('❌ FAIL: No chapters found');
  console.log('   → Click "Generate Chapters" first');
}

// Test 3: Check if transcript exists
console.log('\nTest 3: Transcript Data');
if (typeof transcriptText !== 'undefined' && transcriptText.length > 0) {
  console.log('✅ PASS: Transcript exists:', transcriptText.length, 'characters');
  console.log('   Preview:', transcriptText.substring(0, 100) + '...');
} else {
  console.log('⚠️  WARN: No transcript found');
  console.log('   → Quiz will still work with fallback');
}

// Test 4: Check if quiz button exists
console.log('\nTest 4: Quiz Button');
const quizBtn = document.getElementById('vla-generate-quiz-btn');
if (quizBtn) {
  console.log('✅ PASS: Quiz button found');
  console.log('   Visible:', quizBtn.style.display !== 'none');
  console.log('   Disabled:', quizBtn.disabled);
} else {
  console.log('❌ FAIL: Quiz button not found');
  console.log('   → Switch to Quiz tab first');
}

// Test 5: Test quiz generation (if chapters exist)
if (typeof chapterData !== 'undefined' && chapterData.length > 0) {
  console.log('\nTest 5: Quiz Generation');
  console.log('🔄 Attempting to generate quiz...');
  
  chrome.runtime.sendMessage(
    { 
      action: 'generateQuiz',
      chapters: chapterData,
      transcript: transcriptText || ''
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.log('❌ FAIL: Message error:', chrome.runtime.lastError.message);
      } else if (response && response.success && response.questions) {
        console.log('✅ PASS: Quiz generated successfully!');
        console.log('   Questions:', response.questions.length);
        console.log('   First question:', response.questions[0].question);
        console.log('   Difficulty:', response.questions[0].difficulty || 'not set');
        console.log('\n📊 All Questions:');
        response.questions.forEach((q, i) => {
          console.log(`   ${i + 1}. ${q.question}`);
          console.log(`      Difficulty: ${q.difficulty || 'medium'}`);
          console.log(`      Options: ${q.options.length}`);
          console.log(`      Correct: ${String.fromCharCode(65 + q.correctIndex)}`);
        });
      } else {
        console.log('❌ FAIL: Quiz generation failed');
        console.log('   Response:', response);
      }
    }
  );
} else {
  console.log('\nTest 5: Quiz Generation');
  console.log('⏭️  SKIP: No chapters available');
  console.log('   → Generate chapters first');
}

// Test 6: Check AI availability
console.log('\nTest 6: AI Availability');
chrome.runtime.sendMessage(
  { action: 'checkAICapabilities' },
  (response) => {
    if (chrome.runtime.lastError) {
      console.log('❌ FAIL: Cannot check AI:', chrome.runtime.lastError.message);
    } else if (response && response.success && response.capabilities) {
      if (response.capabilities.available) {
        console.log('✅ PASS: AI is available');
        console.log('   Status:', response.capabilities.status);
      } else {
        console.log('⚠️  WARN: AI not available');
        console.log('   Status:', response.capabilities.status);
        console.log('   → Fallback quiz will be used');
      }
    } else {
      console.log('❌ FAIL: Invalid AI response');
      console.log('   Response:', response);
    }
  }
);

console.log('\n' + '='.repeat(50));
console.log('🧪 Test Complete!');
console.log('='.repeat(50));
console.log('\nIf you see ❌ FAIL, that feature needs fixing.');
console.log('If you see ⚠️  WARN, feature will work with fallback.');
console.log('If you see ✅ PASS, feature is working correctly!');
console.log('\nWait a few seconds for async tests to complete...\n');
