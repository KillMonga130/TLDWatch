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
      .then(result => {
        sendResponse({
          success: true,
          chapters: Array.isArray(result.chapters) ? result.chapters : [],
          usedFallback: result.usedFallback || false
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
    explainMomentAI(request.context, request.transcript, request.frameData)
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
    console.log('[Offscreen] Checking AI capabilities...');
    console.log('[Offscreen] self.ai exists:', !!self.ai);
    console.log('[Offscreen] self.ai.languageModel exists:', !!self.ai?.languageModel);

    // Check if Chrome Built-in AI is available
    if (!self.ai || !self.ai.languageModel) {
      console.error('[Offscreen] ❌ Chrome Built-in AI not available');
      console.error('[Offscreen] 📖 See AI_SETUP_GUIDE.md for setup instructions');
      return {
        available: false,
        reason: 'Chrome Built-in AI not available. Use Chrome Dev/Canary with flags enabled. See AI_SETUP_GUIDE.md',
        status: 'unavailable'
      };
    }

    // Check availability status
    const availability = await self.ai.languageModel.availability();
    console.log('[Offscreen] AI availability status:', availability);

    // Available if 'readily' or 'after-download'
    const isAvailable = availability === 'readily' || availability === 'after-download';

    if (isAvailable) {
      console.log('[Offscreen] ✅ AI is available and ready!');
    } else {
      console.warn('[Offscreen] ⚠️ AI status:', availability);
      console.warn('[Offscreen] 📖 See AI_SETUP_GUIDE.md for setup instructions');
    }

    return {
      available: isAvailable,
      status: availability,
      reason: isAvailable ? null : `AI status: ${availability}. See AI_SETUP_GUIDE.md for setup instructions.`
    };
  } catch (error) {
    console.error('[Offscreen] Capability check error:', error);
    return {
      available: false,
      reason: 'Error checking AI availability: ' + error.message,
      status: 'error'
    };
  }
}

async function generateChaptersAI(transcript, metadata = {}) {
  try {
    if (!transcript || typeof transcript !== 'string') {
      console.warn('[Offscreen] Invalid transcript');
      const chapters = generateBasicChapters(transcript || '', metadata);
      return { chapters, usedFallback: true };
    }

    if (transcript.length < 50) {
      return {
        chapters: [{
          timestamp: '0:00',
          timestampSeconds: 0,
          title: 'Full Content',
          summary: transcript
        }],
        usedFallback: true
      };
    }

    // Check AI availability
    if (!self.ai || !self.ai.languageModel) {
      console.log('[Offscreen] AI not available, using fallback');
      const chapters = generateBasicChapters(transcript, metadata);
      return { chapters, usedFallback: true };
    }

    const availability = await self.ai.languageModel.availability();
    console.log('[Offscreen] LM availability:', availability);

    if (availability === 'unavailable') {
      const chapters = generateBasicChapters(transcript, metadata);
      return { chapters, usedFallback: true };
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
        const fallbackChapters = generateBasicChapters(transcript, metadata);
        return { chapters: fallbackChapters, usedFallback: true };
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
        const chapters = generateBasicChapters(transcript, metadata);
        return { chapters, usedFallback: true };
      }

      console.log(`[Offscreen] ✅ Generated ${validChapters.length} AI chapters`);
      return { chapters: validChapters, usedFallback: false };
    } catch (parseError) {
      console.error('[Offscreen] JSON parse error:', parseError);
      const chapters = generateBasicChapters(transcript, metadata);
      return { chapters, usedFallback: true };
    }
  } catch (error) {
    console.error('[Offscreen] Chapter generation error:', error);
    const chapters = generateBasicChapters(transcript, metadata);
    return { chapters, usedFallback: true };
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
  console.log('[Offscreen] Using fallback chapter generation (no AI)');

  try {
    if (!transcript || typeof transcript !== 'string' || transcript.length < 50) {
      return [{
        timestamp: '0:00',
        timestampSeconds: 0,
        title: metadata.title || 'Video Content',
        summary: 'No transcript available for chapter generation'
      }];
    }

    const videoDuration = metadata.duration || 600;
    const words = transcript.split(/\s+/).filter(w => w.length > 0);

    // Simple rule: 1 chapter per 300 words or 2 minutes, whichever is smaller
    const wordsPerChapter = 300;
    const maxChapters = Math.min(8, Math.max(3, Math.ceil(videoDuration / 120)));
    const chaptersCount = Math.min(maxChapters, Math.ceil(words.length / wordsPerChapter));

    const chapters = [];
    const wordsPerSection = Math.ceil(words.length / chaptersCount);
    const secondsPerChapter = videoDuration / chaptersCount;

    for (let i = 0; i < chaptersCount; i++) {
      const startIdx = i * wordsPerSection;
      const endIdx = Math.min((i + 1) * wordsPerSection, words.length);
      const chapterWords = words.slice(startIdx, endIdx);

      // Calculate timestamp
      const timestampSeconds = Math.floor(i * secondsPerChapter);
      const timestamp = formatTimestamp(timestampSeconds);

      // Simple title: first 5-7 words
      const titleWords = chapterWords.slice(0, 7).join(' ');
      const title = titleWords.length > 10 ? titleWords : `Section ${i + 1}`;

      // Simple summary: first 25 words
      const summary = chapterWords.slice(0, 25).join(' ') + (chapterWords.length > 25 ? '...' : '');

      chapters.push({
        timestamp,
        timestampSeconds,
        title: title.replace(/[.!?]$/, ''),
        summary
      });
    }

    console.log(`[Offscreen] Generated ${chapters.length} fallback chapters`);
    return chapters;
  } catch (error) {
    console.error('[Offscreen] Fallback generation error:', error);
    return [{
      timestamp: '0:00',
      timestampSeconds: 0,
      title: 'Video Content',
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
        temperature: 0.8, // Higher temperature for more creative questions
        topK: 40
      });
    }

    // Build comprehensive context
    const chaptersText = chapters.map((ch, i) =>
      `Chapter ${i + 1} (${ch.timestamp}): ${ch.title}\n${ch.summary}`
    ).join('\n\n');

    const prompt = `You are an expert educator creating a quiz to test understanding of video content.

VIDEO CHAPTERS:
${chaptersText}

TRANSCRIPT EXCERPT:
${transcript.substring(0, 2000)}

Create 5 diverse multiple-choice questions that:

QUESTION TYPES (use variety):
- Factual recall: "What is X?"
- Conceptual understanding: "Why does X happen?"
- Application: "How would you apply X?"
- Analysis: "What's the relationship between X and Y?"
- Comparison: "What's the difference between X and Y?"

REQUIREMENTS:
1. Each question tests a DIFFERENT chapter or concept
2. Mix difficulty levels (2 easy, 2 medium, 1 hard)
3. 4 options per question - make wrong answers plausible but clearly incorrect
4. Correct answer should be unambiguous
5. Explanation should teach, not just confirm
6. Link each question to the relevant chapter timestamp

WRONG ANSWER GUIDELINES:
- Make them believable but clearly wrong
- Use common misconceptions
- Avoid obviously silly options
- Don't use "All of the above" or "None of the above"

Return ONLY valid JSON array (no markdown, no extra text):
[
  {
    "question": "Clear, specific question about the content?",
    "options": ["Correct answer", "Plausible wrong answer", "Another plausible wrong answer", "Third plausible wrong answer"],
    "correctIndex": 0,
    "explanation": "Detailed explanation of why this is correct and why others are wrong",
    "timestamp": "2:30",
    "timestampSeconds": 150,
    "difficulty": "easy"
  }
]

IMPORTANT: Return ONLY the JSON array, nothing else.`;

    console.log('[Offscreen] Generating quiz with enhanced prompt...');
    const response = await languageModelSession.prompt(prompt);

    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[Offscreen] No JSON array found in response');
        return generateBasicQuiz(chapters);
      }

      const jsonStr = jsonMatch[0];
      const questions = JSON.parse(jsonStr);

      if (!Array.isArray(questions) || questions.length === 0) {
        console.error('[Offscreen] Invalid questions array');
        return generateBasicQuiz(chapters);
      }

      // Validate and enhance questions
      const validQuestions = questions
        .filter(q =>
          q.question &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          typeof q.correctIndex === 'number' &&
          q.correctIndex >= 0 &&
          q.correctIndex < 4
        )
        .map(q => ({
          ...q,
          // Ensure timestamp fields exist
          timestamp: q.timestamp || chapters[0]?.timestamp || '0:00',
          timestampSeconds: q.timestampSeconds || chapters[0]?.timestampSeconds || 0,
          difficulty: q.difficulty || 'medium'
        }))
        .slice(0, 5);

      if (validQuestions.length === 0) {
        console.error('[Offscreen] No valid questions after filtering');
        return generateBasicQuiz(chapters);
      }

      console.log(`[Offscreen] ✅ Generated ${validQuestions.length} quiz questions`);
      return validQuestions;
    } catch (parseError) {
      console.error('[Offscreen] Quiz parse error:', parseError);
      console.error('[Offscreen] Response was:', response.substring(0, 200));
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

  // Question templates for variety
  const templates = [
    {
      type: 'content',
      question: (ch) => `What is the main focus of "${ch.title}"?`,
      wrongAnswers: [
        'A completely unrelated topic',
        'The opposite of what was discussed',
        'A topic from a different video'
      ]
    },
    {
      type: 'sequence',
      question: (ch, i) => `What topic is covered in chapter ${i + 1}?`,
      wrongAnswers: [
        'This is not discussed in the video',
        'This comes from a different section',
        'This is mentioned but not as a main topic'
      ]
    },
    {
      type: 'understanding',
      question: (ch) => `According to the video, what does "${ch.title}" explain?`,
      wrongAnswers: [
        'Something not mentioned in this chapter',
        'A misconception about the topic',
        'An unrelated concept'
      ]
    },
    {
      type: 'recall',
      question: (ch) => `Which of the following best describes "${ch.title}"?`,
      wrongAnswers: [
        'An incorrect interpretation',
        'A different aspect not covered',
        'Something from another chapter'
      ]
    },
    {
      type: 'application',
      question: (ch) => `What key concept is introduced in "${ch.title}"?`,
      wrongAnswers: [
        'A concept not in this video',
        'A related but different concept',
        'An advanced topic not yet covered'
      ]
    }
  ];

  // Generate questions from chapters with variety
  chapters.slice(0, 5).forEach((ch, i) => {
    const template = templates[i % templates.length];

    // Extract key words from summary for wrong answers
    const summaryWords = ch.summary.split(' ').filter(w => w.length > 5);
    const wrongAnswerVariations = [
      `Not related to ${summaryWords[0] || 'the topic'}`,
      `Focuses on ${summaryWords[1] || 'different aspects'} instead`,
      `Discusses ${summaryWords[2] || 'other concepts'} primarily`
    ];

    questions.push({
      question: template.question(ch, i),
      options: [
        ch.summary,
        ...wrongAnswerVariations.slice(0, 3)
      ],
      correctIndex: 0,
      explanation: `This chapter covers: ${ch.summary}. The other options are not accurate descriptions of this chapter's content.`,
      timestamp: ch.timestamp,
      timestampSeconds: ch.timestampSeconds,
      difficulty: 'easy'
    });
  });

  return questions;
}

async function explainMomentAI(context, transcript, frameData) {
  try {
    console.log('[Offscreen] Generating explanation...');
    console.log('[Offscreen] Context:', context);
    console.log('[Offscreen] Has transcript:', !!transcript);
    console.log('[Offscreen] Has frame:', !!frameData);

    // If no transcript, provide context-based explanation
    if (!transcript || transcript.length < 10) {
      console.log('[Offscreen] No transcript, using context only');
      return context + '. The video is presenting this content at this moment.';
    }

    if (!self.ai || !self.ai.languageModel) {
      console.log('[Offscreen] AI not available, using fallback');
      // Provide intelligent fallback based on context
      return `${context}. ${transcript.substring(0, 150)}...`;
    }

    const availability = await self.ai.languageModel.availability();
    console.log('[Offscreen] AI availability:', availability);

    if (availability === 'unavailable') {
      // Provide intelligent fallback
      return `${context}. ${transcript.substring(0, 150)}...`;
    }

    if (!languageModelSession) {
      console.log('[Offscreen] Creating AI session...');
      languageModelSession = await self.ai.languageModel.create({
        temperature: 0.7,
        topK: 40
      });
    }

    // Text-only prompt (multimodal not yet supported in Chrome AI)
    const prompt = `Explain what's happening at this moment in the video in 1-2 clear sentences.

${context}

TRANSCRIPT EXCERPT:
${transcript.substring(0, 800)}

Provide a concise, helpful explanation (max 200 characters):`;

    console.log('[Offscreen] Sending prompt to AI...');
    const response = await languageModelSession.prompt(prompt);
    console.log('[Offscreen] AI response received:', response.substring(0, 100));

    // Clean up response
    const explanation = response.trim().substring(0, 250);
    return explanation || `${context}. The video is explaining this topic in detail.`;
  } catch (error) {
    console.error('[Offscreen] Explanation error:', error);
    // Provide intelligent fallback even on error
    if (transcript && transcript.length > 10) {
      return `${context}. ${transcript.substring(0, 150)}...`;
    }
    return context + '. The video is presenting this content.';
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