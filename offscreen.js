/**
 * Offscreen Document - Chrome AI APIs Handler - FIXED
 */

console.log('[Offscreen] Document initialized');

let languageModelSession = null;

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Offscreen] Request:', request.action);
  
  if (!request || !request.action) {
    sendResponse({ success: false, error: 'No action specified' });
    return false;
  }

  if (request.action === 'generateChapters') {
    generateChaptersAI(request.transcript, request.metadata)
      .then(chapters => {
        sendResponse({ 
          success: true, 
          chapters: Array.isArray(chapters) ? chapters : []
        });
      })
      .catch(error => {
        console.error('[Offscreen] Generation error:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Generation failed',
          chapters: []
        });
      });
    return true;
  }
  
  if (request.action === 'transcribeAudio') {
    transcribeAudioAI(request.audioBlob)
      .then(text => sendResponse({ success: true, text }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'checkAICapabilities') {
    checkCapabilities()
      .then(caps => sendResponse({ 
        success: true, 
        capabilities: caps || { available: false }
      }))
      .catch(error => {
        console.error('[Offscreen] Capability check error:', error);
        sendResponse({ 
          success: false, 
          capabilities: { 
            available: false, 
            reason: error.message 
          }
        });
      });
    return true;
  }

  if (request.action === 'generateQuiz') {
    generateQuizAI(request.chapters, request.transcript)
      .then(questions => sendResponse({ success: true, questions }))
      .catch(error => {
        console.error('[Offscreen] Quiz generation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'explainMoment') {
    explainMomentAI(request.context, request.transcript)
      .then(explanation => sendResponse({ success: true, explanation }))
      .catch(error => {
        console.error('[Offscreen] Explanation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  return false;
});

async function checkCapabilities() {
  try {
    // ✅ FIX: Proper null check
    if (!self.ai || typeof self.ai.languageModel !== 'object') {
      console.log('[Offscreen] AI APIs not available');
      return { 
        available: false, 
        reason: 'AI APIs not available',
        status: 'unavailable'
      };
    }
    
    const availability = await self.ai.languageModel.availability();
    console.log('[Offscreen] AI availability:', availability);
    
    return {
      available: availability === 'readily' || availability === 'after-download',
      status: availability,
      reason: null
    };
  } catch (error) {
    console.error('[Offscreen] Capability check error:', error);
    return { 
      available: false, 
      reason: error.message,
      status: 'error'
    };
  }
}

async function generateChaptersAI(transcript, metadata = {}) {
  try {
    if (!transcript || typeof transcript !== 'string') {
      console.warn('[Offscreen] Invalid transcript');
      return generateBasicChapters(transcript || '', metadata);
    }

    if (transcript.length < 50) {
      return [{
        timestamp: '0:00',
        timestampSeconds: 0,
        title: 'Full Content',
        summary: transcript
      }];
    }
    
    // Check AI availability
    if (!self.ai || !self.ai.languageModel) {
      console.log('[Offscreen] AI not available, using fallback');
      return generateBasicChapters(transcript, metadata);
    }

    const availability = await self.ai.languageModel.availability();
    console.log('[Offscreen] LM availability:', availability);
    
    if (availability === 'unavailable') {
      return generateBasicChapters(transcript, metadata);
    }
    
    // Initialize Language Model
    if (!languageModelSession) {
      console.log('[Offscreen] Creating language model session...');
      languageModelSession = await self.ai.languageModel.create({
        temperature: 0.7,
        topK: 40
      });
    }
    
    // Enhanced AI prompt with better instructions
    const videoDuration = metadata.duration || 0;
    const videoTitle = metadata.title || 'Video';
    const platform = metadata.platform || 'unknown';
    
    const prompt = `You are an expert at analyzing educational video content and creating structured chapter breakdowns.

VIDEO INFORMATION:
- Title: ${videoTitle}
- Platform: ${platform}
- Duration: ${Math.floor(videoDuration / 60)} minutes ${Math.floor(videoDuration % 60)} seconds

TASK: Analyze the transcript below and create 5-8 logical chapters that represent distinct topics or sections.

REQUIREMENTS:
1. Each chapter must have:
   - timestamp: Start time in "M:SS" or "MM:SS" format (e.g., "0:00", "2:30", "15:45")
   - title: Clear, descriptive title (5-10 words)
   - summary: Concise summary of what's covered (1-2 sentences, max 150 characters)

2. Chapters should:
   - Cover the entire video duration proportionally
   - Represent natural topic transitions
   - Be evenly distributed (not all at the beginning)
   - Have meaningful, specific titles (not generic like "Part 1")

3. Return ONLY a valid JSON array, no other text

TRANSCRIPT:
${transcript.substring(0, 3000)}

${transcript.length > 3000 ? '...[transcript continues]' : ''}

OUTPUT FORMAT (JSON array only):
[
  { "timestamp": "0:00", "title": "Introduction to Topic", "summary": "Overview of what will be covered in this video." },
  { "timestamp": "3:45", "title": "Core Concept Explanation", "summary": "Detailed explanation of the main concept with examples." }
]`;
    
    console.log('[Offscreen] Sending enhanced prompt to AI...');
    const response = await languageModelSession.prompt(prompt);
    console.log('[Offscreen] AI Response received:', response.substring(0, 200));
    
    try {
      // Parse response safely
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response.trim();
      const chapters = JSON.parse(jsonStr);
      
      if (!Array.isArray(chapters)) {
        console.warn('[Offscreen] AI response not an array');
        return generateBasicChapters(transcript, metadata);
      }
      
      // Validate and enhance chapters
      const validChapters = chapters
        .filter(ch => ch && ch.timestamp && ch.title)
        .map(ch => ({
          ...ch,
          timestampSeconds: parseTimestampToSeconds(ch.timestamp),
          summary: ch.summary || ''
        }))
        .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
        .slice(0, 20);
      
      if (validChapters.length === 0) {
        return generateBasicChapters(transcript, metadata);
      }
      
      console.log(`[Offscreen] ✅ Generated ${validChapters.length} AI chapters`);
      return validChapters;
    } catch (parseError) {
      console.error('[Offscreen] JSON parse error:', parseError);
      return generateBasicChapters(transcript, metadata);
    }
  } catch (error) {
    console.error('[Offscreen] Chapter generation error:', error);
    return generateBasicChapters(transcript, metadata);
  }
}

function parseTimestampToSeconds(timestamp) {
  if (!timestamp) return 0;
  
  const parts = timestamp.split(':').map(p => parseInt(p) || 0);
  
  if (parts.length === 3) {
    // H:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // M:SS or MM:SS
    return parts[0] * 60 + parts[1];
  } else {
    return 0;
  }
}

function generateBasicChapters(transcript, metadata = {}) {
  try {
    if (!transcript || typeof transcript !== 'string') {
      return [{
        timestamp: '0:00',
        timestampSeconds: 0,
        title: 'Content',
        summary: 'Video content'
      }];
    }

    const videoDuration = metadata.duration || 600; // Default 10 minutes
    const words = transcript.split(/\s+/).filter(w => w.length > 0);
    
    // Determine optimal chapter count based on content length and duration
    const wordsPerChapter = 250;
    const maxChapters = Math.min(10, Math.max(3, Math.ceil(videoDuration / 120))); // 1 chapter per 2 minutes
    const chaptersCount = Math.min(maxChapters, Math.ceil(words.length / wordsPerChapter));
    
    const chapters = [];
    const wordsPerSection = Math.ceil(words.length / chaptersCount);
    const secondsPerChapter = videoDuration / chaptersCount;
    
    for (let i = 0; i < chaptersCount; i++) {
      const startIdx = i * wordsPerSection;
      const endIdx = Math.min((i + 1) * wordsPerSection, words.length);
      const chapterWords = words.slice(startIdx, endIdx);
      const chapterText = chapterWords.join(' ');
      
      // Calculate timestamp
      const timestampSeconds = Math.floor(i * secondsPerChapter);
      const timestamp = formatTimestamp(timestampSeconds);
      
      // Extract key phrases for title (first few words or sentence)
      const firstSentence = chapterText.match(/^[^.!?]+[.!?]/)?.[0] || chapterText.substring(0, 50);
      const titleWords = firstSentence.split(/\s+/).slice(0, 6).join(' ');
      const title = titleWords.length > 5 ? titleWords : `Section ${i + 1}`;
      
      // Create summary
      const summary = chapterText.substring(0, 120).trim() + (chapterText.length > 120 ? '...' : '');
      
      chapters.push({
        timestamp,
        timestampSeconds,
        title: title.replace(/[.!?]$/, ''),
        summary
      });
    }
    
    return chapters.length > 0 ? chapters : [{
      timestamp: '0:00',
      timestampSeconds: 0,
      title: metadata.title || 'Full Video',
      summary: transcript.substring(0, 150)
    }];
  } catch (error) {
    console.error('[Offscreen] Fallback generation error:', error);
    return [{
      timestamp: '0:00',
      timestampSeconds: 0,
      title: 'Content',
      summary: 'Unable to generate chapters'
    }];
  }
}

function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function generateQuizAI(chapters, transcript) {
  try {
    if (!self.ai || !self.ai.languageModel) {
      return generateBasicQuiz(chapters);
    }

    const availability = await self.ai.languageModel.availability();
    if (availability === 'unavailable') {
      return generateBasicQuiz(chapters);
    }

    if (!languageModelSession) {
      languageModelSession = await self.ai.languageModel.create({
        temperature: 0.7,
        topK: 40
      });
    }

    const chaptersText = chapters.map(ch => `${ch.title}: ${ch.summary}`).join('\n');
    
    const prompt = `Based on this video content, create 5 multiple-choice quiz questions to test understanding.

CHAPTERS:
${chaptersText}

TRANSCRIPT EXCERPT:
${transcript.substring(0, 1500)}

Create 5 questions that:
1. Test key concepts from different chapters
2. Have 4 options each (A, B, C, D)
3. Include explanations for correct answers
4. Link to relevant chapter timestamps when possible

Return ONLY valid JSON array:
[
  {
    "question": "What is the main topic discussed?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Explanation of why this is correct",
    "timestamp": "2:30",
    "timestampSeconds": 150
  }
]`;

    const response = await languageModelSession.prompt(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response.trim();
      const questions = JSON.parse(jsonStr);
      
      if (!Array.isArray(questions) || questions.length === 0) {
        return generateBasicQuiz(chapters);
      }
      
      return questions.slice(0, 5);
    } catch (parseError) {
      console.error('[Offscreen] Quiz parse error:', parseError);
      return generateBasicQuiz(chapters);
    }
  } catch (error) {
    console.error('[Offscreen] Quiz generation error:', error);
    return generateBasicQuiz(chapters);
  }
}

function generateBasicQuiz(chapters) {
  if (!chapters || chapters.length === 0) {
    return [];
  }

  const questions = [];
  
  // Generate questions from chapters
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

async function explainMomentAI(context, transcript) {
  try {
    if (!self.ai || !self.ai.languageModel) {
      return 'At this moment in the video, the content is being presented.';
    }

    const availability = await self.ai.languageModel.availability();
    if (availability === 'unavailable') {
      return 'At this moment in the video, the content is being presented.';
    }

    if (!languageModelSession) {
      languageModelSession = await self.ai.languageModel.create({
        temperature: 0.7,
        topK: 40
      });
    }

    const prompt = `Explain what's happening at this moment in the video in 1-2 sentences.

CONTEXT: ${context}

TRANSCRIPT: ${transcript.substring(0, 500)}

Provide a clear, concise explanation (max 150 characters):`;

    const response = await languageModelSession.prompt(prompt);
    
    // Clean up response
    const explanation = response.trim().substring(0, 200);
    return explanation || 'At this moment, the video is presenting key concepts.';
  } catch (error) {
    console.error('[Offscreen] Explanation error:', error);
    return 'At this moment in the video, the content is being presented.';
  }
}

async function transcribeAudioAI() {
  try {
    // Placeholder - real transcription requires more complex audio processing
    return 'Transcription not yet implemented';
  } catch (error) {
    console.error('[Offscreen] Transcription error:', error);
    return 'Transcription failed';
  }
}