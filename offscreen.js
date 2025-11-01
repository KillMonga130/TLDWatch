/**
 * Offscreen Document - Chrome AI APIs Handler - ENHANCED
 * Uses all 6 Chrome Built-in AI APIs (Gemini Nano)
 */

console.log('[Offscreen] Document initialized');

let languageModelSession = null;

// API availability cache
let apiCapabilities = {
  writer: false,
  rewriter: false,
  proofreader: false,
  summarizer: false,
  translator: false,
  languageDetector: false
};

// Session caches
let writerSession = null;
let rewriterSession = null;
let proofreaderSession = null;

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

  if (request.action === 'summarizeText') {
    summarizeTextAI(request.text)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'improveText') {
    improveTextAI(request.text)
      .then(improved => sendResponse({ success: true, improved }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'translateText') {
    translateTextAI(request.text, request.targetLanguage)
      .then(translated => sendResponse({ success: true, translated }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'proofreadText') {
    proofreadTextAI(request.text)
      .then(corrected => sendResponse({ success: true, corrected }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'generateRecommendations') {
    generateRecommendationsAI(request.chapters, request.metadata)
      .then(recommendations => sendResponse({ success: true, recommendations }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  return false;
});

async function checkCapabilities() {
  try {
    console.log('[Offscreen] 🔍 Checking Chrome Built-in AI APIs...');
    
    // Check Writer API
    if ('Writer' in self) {
      try {
        const availability = await Writer.availability();
        apiCapabilities.writer = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] ✏️ Writer API:', apiCapabilities.writer ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] ✏️ Writer API: ❌', e.message);
      }
    }
    
    // Check Rewriter API
    if ('Rewriter' in self) {
      try {
        const availability = await Rewriter.availability();
        apiCapabilities.rewriter = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] 🖊️ Rewriter API:', apiCapabilities.rewriter ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] 🖊️ Rewriter API: ❌', e.message);
      }
    }
    
    // Check Proofreader API
    if ('Proofreader' in self) {
      try {
        const availability = await Proofreader.availability();
        apiCapabilities.proofreader = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] 🔤 Proofreader API:', apiCapabilities.proofreader ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] 🔤 Proofreader API: ❌', e.message);
      }
    }
    
    // Check Summarizer API
    if ('Summarizer' in self) {
      try {
        const availability = await Summarizer.availability();
        apiCapabilities.summarizer = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] 📄 Summarizer API:', apiCapabilities.summarizer ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] 📄 Summarizer API: ❌', e.message);
      }
    }
    
    // Check Translator API
    if ('Translator' in self) {
      try {
        const availability = await Translator.availability();
        apiCapabilities.translator = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] 🌐 Translator API:', apiCapabilities.translator ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] 🌐 Translator API: ❌', e.message);
      }
    }
    
    // Check Language Detector API
    if ('LanguageDetector' in self) {
      try {
        const availability = await LanguageDetector.availability();
        apiCapabilities.languageDetector = (availability === 'readily' || availability === 'after-download');
        console.log('[Offscreen] 🔍 Language Detector API:', apiCapabilities.languageDetector ? '✅' : '❌', `(${availability})`);
      } catch (e) {
        console.log('[Offscreen] 🔍 Language Detector API: ❌', e.message);
      }
    }

    const hasAnyAPI = Object.values(apiCapabilities).some(v => v === true);
    
    if (hasAnyAPI) {
      console.log('[Offscreen] ✅ Chrome Built-in AI APIs available!');
      return {
        available: true,
        capabilities: apiCapabilities,
        status: 'ready'
      };
    } else {
      console.error('[Offscreen] ❌ No Chrome AI APIs available');
      console.error('[Offscreen] 📖 Enable flags: chrome://flags/#writer-api-for-gemini-nano');
      return {
        available: false,
        capabilities: apiCapabilities,
        status: 'unavailable',
        reason: 'Chrome Built-in AI not available. Enable flags and join origin trial.'
      };
    }
  } catch (error) {
    console.error('[Offscreen] Capability check error:', error);
    return {
      available: false,
      capabilities: apiCapabilities,
      status: 'error',
      reason: error.message
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

    const videoDuration = metadata.duration || 0;
    const videoTitle = metadata.title || 'Video';
    const platform = metadata.platform || 'unknown';

    // TRY WRITER API (Chrome Built-in AI)
    if (apiCapabilities.writer) {
      try {
        console.log('[Offscreen] ✏️ Using Writer API...');
        
        if (!writerSession) {
          writerSession = await Writer.create({
            tone: 'neutral',
            format: 'plain-text',
            length: 'medium',
            sharedContext: 'Analyzing educational video content to create structured chapter breakdowns.',
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => {
                console.log(`[Offscreen] Writer model download: ${Math.round(e.loaded * 100)}%`);
              });
            }
          });
        }

        const prompt = `Analyze this video and create 5-8 chapter breakdowns.

VIDEO: ${videoTitle} (${Math.floor(videoDuration / 60)}m ${Math.floor(videoDuration % 60)}s on ${platform})

TRANSCRIPT:
${transcript.substring(0, 3000)}

Return ONLY a valid JSON array with this exact format:
[{"timestamp":"0:00","title":"Introduction","summary":"Overview of topics covered"}]

Each chapter needs: timestamp (M:SS format), title (5-10 words), summary (max 150 chars).`;

        const response = await writerSession.write(prompt);
        console.log('[Offscreen] ✅ Writer API response received');
        
        const chapters = parseChaptersFromResponse(response, transcript, metadata);
        if (chapters && chapters.length > 0) {
          console.log(`[Offscreen] ✅ Generated ${chapters.length} chapters with Writer API`);
          return { chapters, usedFallback: false, apiUsed: 'writer' };
        }
      } catch (writerError) {
        console.warn('[Offscreen] ⚠️ Writer API failed:', writerError.message);
        writerSession = null; // Reset session on error
      }
    }

    // FALLBACK TO SUMMARIZER + REWRITER
    if (apiCapabilities.summarizer && apiCapabilities.rewriter) {
      try {
        console.log('[Offscreen] 📄 Using Summarizer + Rewriter APIs (fallback)...');
        
        // Split transcript into chunks
        const chunkSize = 500;
        const words = transcript.split(/\s+/);
        const numChapters = Math.min(8, Math.max(3, Math.ceil(words.length / chunkSize)));
        const wordsPerChapter = Math.ceil(words.length / numChapters);
        
        const chapters = [];
        
        for (let i = 0; i < numChapters; i++) {
          const startIdx = i * wordsPerChapter;
          const endIdx = Math.min((i + 1) * wordsPerChapter, words.length);
          const chunkText = words.slice(startIdx, endIdx).join(' ');
          
          // Use Summarizer to get summary
          const summarizer = await Summarizer.create({
            type: 'key-points',
            format: 'plain-text',
            length: 'short'
          });
          
          const summary = await summarizer.summarize(chunkText);
          
          // Use Rewriter to create a better title
          const rewriter = await Rewriter.create({
            tone: 'as-is',
            format: 'plain-text',
            length: 'shorter'
          });
          
          const title = await rewriter.rewrite(summary.substring(0, 100), {
            context: 'Create a short chapter title'
          });
          
          const timestampSeconds = Math.floor((i * videoDuration) / numChapters);
          
          chapters.push({
            timestamp: formatTimestamp(timestampSeconds),
            timestampSeconds,
            title: title.substring(0, 60),
            summary: summary.substring(0, 150)
          });
          
          summarizer.destroy();
          rewriter.destroy();
        }
        
        console.log(`[Offscreen] ✅ Generated ${chapters.length} chapters with Summarizer + Rewriter`);
        return { chapters, usedFallback: false, apiUsed: 'summarizer+rewriter' };
      } catch (fallbackError) {
        console.warn('[Offscreen] ⚠️ Summarizer + Rewriter failed:', fallbackError.message);
      }
    }

    // FINAL FALLBACK: Rule-based generation
    console.log('[Offscreen] ⚠️ All AI APIs failed, using rule-based fallback');
    const chapters = generateBasicChapters(transcript, metadata);
    return { chapters, usedFallback: true, apiUsed: 'none' };
    
  } catch (error) {
    console.error('[Offscreen] Chapter generation error:', error);
    const chapters = generateBasicChapters(transcript, metadata);
    return { chapters, usedFallback: true, apiUsed: 'none' };
  }
}

function parseChaptersFromResponse(response, transcript, metadata) {
  try {
    // Handle different response formats
    let chapters = null;
    
    if (response.chapters && Array.isArray(response.chapters)) {
      chapters = response.chapters;
    } else if (typeof response === 'string') {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        chapters = JSON.parse(jsonMatch[0]);
      }
    } else if (Array.isArray(response)) {
      chapters = response;
    }

    if (!chapters || !Array.isArray(chapters)) {
      return null;
    }

    // Validate and enhance
    const validChapters = chapters
      .filter(ch => ch && ch.timestamp && ch.title)
      .map(ch => ({
        ...ch,
        timestampSeconds: parseTimestampToSeconds(ch.timestamp),
        summary: ch.summary || ''
      }))
      .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
      .slice(0, 20);

    return validChapters.length > 0 ? validChapters : null;
  } catch (error) {
    console.error('[Offscreen] Parse error:', error);
    return null;
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
    const chaptersText = chapters.map((ch, i) =>
      `Chapter ${i + 1} (${ch.timestamp}): ${ch.title}\n${ch.summary}`
    ).join('\n\n');

    // TRY WRITER API
    if (apiCapabilities.writer) {
      try {
        console.log('[Offscreen] ✏️ Using Writer API for quiz generation...');
        
        if (!writerSession) {
          writerSession = await Writer.create({
            tone: 'neutral',
            format: 'plain-text',
            length: 'medium',
            sharedContext: 'Creating educational quiz questions to test understanding of video content.'
          });
        }

        const prompt = `Create 5 multiple-choice quiz questions testing understanding of this video content.

CHAPTERS:
${chaptersText}

TRANSCRIPT:
${transcript.substring(0, 2000)}

Requirements:
- 4 options each, one correct
- Mix difficulty (2 easy, 2 medium, 1 hard)
- Include explanations
- Link to chapter timestamps

Return ONLY valid JSON array:
[{"question":"...","options":["..."],"correctIndex":0,"explanation":"...","timestamp":"0:00","timestampSeconds":0,"difficulty":"easy"}]`;

        const response = await writerSession.write(prompt);
        console.log('[Offscreen] ✅ Writer API response received');
        
        const questions = parseQuizFromResponse(response, chapters);
        if (questions && questions.length > 0) {
          console.log(`[Offscreen] ✅ Generated ${questions.length} questions with Writer API`);
          return questions;
        }
      } catch (writerError) {
        console.warn('[Offscreen] ⚠️ Writer API failed:', writerError.message);
        writerSession = null;
      }
    }

    // FALLBACK TO REWRITER API (create questions from chapter summaries)
    if (apiCapabilities.rewriter) {
      try {
        console.log('[Offscreen] 🖊️ Using Rewriter API for quiz (fallback)...');
        
        if (!rewriterSession) {
          rewriterSession = await Rewriter.create({
            tone: 'more-formal',
            format: 'plain-text',
            length: 'as-is',
            sharedContext: 'Transforming chapter summaries into quiz questions.'
          });
        }

        const questions = [];
        
        for (let i = 0; i < Math.min(5, chapters.length); i++) {
          const ch = chapters[i];
          
          // Rewrite summary as a question
          const questionText = await rewriterSession.rewrite(
            `What is covered in: ${ch.summary}`,
            { context: 'Transform this into a clear quiz question' }
          );
          
          questions.push({
            question: questionText,
            options: [
              ch.summary,
              'This topic is not covered in the video',
              'A different concept entirely',
              'None of the above'
            ],
            correctIndex: 0,
            explanation: `This chapter covers: ${ch.summary}`,
            timestamp: ch.timestamp,
            timestampSeconds: ch.timestampSeconds,
            difficulty: 'easy'
          });
        }
        
        console.log(`[Offscreen] ✅ Generated ${questions.length} questions with Rewriter API`);
        return questions;
      } catch (rewriterError) {
        console.warn('[Offscreen] ⚠️ Rewriter API failed:', rewriterError.message);
        rewriterSession = null;
      }
    }

    // FINAL FALLBACK
    console.log('[Offscreen] ⚠️ All AI APIs failed, using rule-based quiz');
    return generateBasicQuiz(chapters);
    
  } catch (error) {
    console.error('[Offscreen] Quiz generation error:', error);
    return generateBasicQuiz(chapters);
  }
}

function parseQuizFromResponse(response, chapters) {
  try {
    let questions = null;
    
    if (typeof response === 'string') {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } else if (Array.isArray(response)) {
      questions = response;
    }

    if (!questions || !Array.isArray(questions)) {
      return null;
    }

    const validQuestions = questions
      .filter(q =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === 'number'
      )
      .map(q => ({
        ...q,
        timestamp: q.timestamp || chapters[0]?.timestamp || '0:00',
        timestampSeconds: q.timestampSeconds || chapters[0]?.timestampSeconds || 0,
        difficulty: q.difficulty || 'medium'
      }))
      .slice(0, 5);

    return validQuestions.length > 0 ? validQuestions : null;
  } catch (error) {
    console.error('[Offscreen] Quiz parse error:', error);
    return null;
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

// 📄 SUMMARIZER API - Distill complex content
async function summarizeTextAI(text) {
  try {
    if (!text || text.length < 50) {
      return text;
    }

    // TRY SUMMARIZER API
    if (apiCapabilities.summarizer) {
      try {
        console.log('[Offscreen] 📄 Using Summarizer API...');
        const summarizer = await Summarizer.create({
          type: 'key-points',
          format: 'plain-text',
          length: 'short'
        });
        
        const result = await summarizer.summarize(text.substring(0, 5000));
        summarizer.destroy();
        
        console.log('[Offscreen] ✅ Summarizer API success');
        return result;
      } catch (error) {
        console.warn('[Offscreen] ⚠️ Summarizer API failed:', error.message);
      }
    }

    // Simple fallback
    return text.substring(0, 200) + '...';
  } catch (error) {
    console.error('[Offscreen] Summarize error:', error);
    return text.substring(0, 200) + '...';
  }
}

// 🖊️ REWRITER API - Improve and refine text
async function improveTextAI(text) {
  try {
    if (!text || text.length < 3) {
      return text;
    }

    // TRY REWRITER API
    if (apiCapabilities.rewriter) {
      try {
        console.log('[Offscreen] 🖊️ Using Rewriter API...');
        
        if (!rewriterSession) {
          rewriterSession = await Rewriter.create({
            tone: 'as-is',
            format: 'plain-text',
            length: 'as-is',
            sharedContext: 'Improving text clarity and engagement.'
          });
        }
        
        const result = await rewriterSession.rewrite(text, {
          context: 'Make this clearer and more engaging'
        });
        
        console.log('[Offscreen] ✅ Rewriter API success');
        return result;
      } catch (error) {
        console.warn('[Offscreen] ⚠️ Rewriter API failed:', error.message);
        rewriterSession = null;
      }
    }

    return text;
  } catch (error) {
    console.error('[Offscreen] Improve error:', error);
    return text;
  }
}

// 🌐 TRANSLATOR API - Multilingual support
async function translateTextAI(text, targetLanguage = 'es') {
  try {
    if (!text || text.length < 3) {
      return text;
    }

    // TRY TRANSLATOR API
    if (apiCapabilities.translator) {
      try {
        console.log('[Offscreen] 🌐 Using Translator API...');
        
        const translator = await Translator.create({
          sourceLanguage: 'en',
          targetLanguage: targetLanguage
        });
        
        const result = await translator.translate(text);
        translator.destroy();
        
        console.log('[Offscreen] ✅ Translator API success');
        return result;
      } catch (error) {
        console.warn('[Offscreen] ⚠️ Translator API failed:', error.message);
      }
    }

    // FallbackACK: Use Language Model
    if (apiCapabilities.languageModel && languageModelSession) {
      const response = await languageModelSession.prompt(`Translate this to ${targetLanguage}:\n\n${text}`);
      return response.trim();
    }

    return text + ` [Translation to ${targetLanguage} unavailable]`;
  } catch (error) {
    console.error('[Offscreen] Translate error:', error);
    return text;
  }
}

// 🔤 PROOFREADER API - Grammar and spelling correction
async function proofreadTextAI(text) {
  try {
    if (!text || text.length < 3) {
      return text;
    }

    // TRY PROOFREADER API
    if (apiCapabilities.proofreader) {
      try {
        console.log('[Offscreen] 🔤 Using Proofreader API...');
        
        if (!proofreaderSession) {
          proofreaderSession = await Proofreader.create({
            expectedInputLanguages: ['en']
          });
        }
        
        const result = await proofreaderSession.proofread(text);
        
        console.log('[Offscreen] ✅ Proofreader API success');
        
        // Return the corrected text
        return result.corrected || result;
      } catch (error) {
        console.warn('[Offscreen] ⚠️ Proofreader API failed:', error.message);
        proofreaderSession = null;
      }
    }

    return text;
  } catch (error) {
    console.error('[Offscreen] Proofread error:', error);
    return text;
  }
}

// ✨ GENERATE RECOMMENDATIONS - Using Writer API
async function generateRecommendationsAI(chapters, metadata) {
  try {
    const videoTitle = metadata.title || 'Video';
    const platform = metadata.platform || 'platform';
    const chaptersText = chapters.slice(0, 3).map(ch => ch.title).join(', ');

    // TRY WRITER API
    if (apiCapabilities.writer && chrome.ai && chrome.ai.writer) {
      try {
        console.log('[Offscreen] ✏️ Using Writer API for recommendations...');
        
        const writerPayload = {
          input: `Generate 4 related learning recommendations for someone watching: "${videoTitle}" on ${platform}.

Topics covered: ${chaptersText}

Create recommendations with:
- title: Engaging title for related content
- description: Brief description (max 100 chars)
- platform: Suggested platform
- type: Category (Next Level, Foundation, Practice, Related)

Return JSON: [{"title":"...","description":"...","platform":"...","type":"..."}]`,
          style: 'professional'
        };

        const response = await chrome.ai.writer.write(writerPayload);
        console.log('[Offscreen] ✅ Writer API response for recommendations');
        
        const recommendations = parseRecommendationsFromResponse(response.content || response, metadata);
        if (recommendations && recommendations.length > 0) {
          return recommendations;
        }
      } catch (writerError) {
        console.warn('[Offscreen] ⚠️ Writer API failed for recommendations:', writerError.message);
      }
    }

    // FALLBACK: Generate simple recommendations
    return generateSimpleRecommendations(chapters, metadata);
    
  } catch (error) {
    console.error('[Offscreen] Recommendations error:', error);
    return generateSimpleRecommendations(chapters, metadata);
  }
}

function parseRecommendationsFromResponse(response, metadata) {
  try {
    let recommendations = null;
    
    if (typeof response === 'string') {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } else if (Array.isArray(response)) {
      recommendations = response;
    }

    if (!recommendations || !Array.isArray(recommendations)) {
      return null;
    }

    const validRecs = recommendations
      .filter(rec => rec && rec.title && rec.description)
      .map(rec => ({
        title: rec.title,
        description: rec.description,
        platform: rec.platform || 'Learning Platform',
        type: rec.type || 'Related'
      }))
      .slice(0, 4);

    return validRecs.length > 0 ? validRecs : null;
  } catch (error) {
    console.error('[Offscreen] Parse recommendations error:', error);
    return null;
  }
}

function generateSimpleRecommendations(chapters, metadata) {
  const title = metadata.title || 'Video Content';
  const platform = metadata.platform || 'video platform';
  const topics = chapters.slice(0, 3).map(ch => {
    const words = ch.title.split(/\s+/).filter(w => w.length > 4);
    return words[0] || 'topic';
  });
  const mainTopic = topics[0] || 'topic';

  return [
    {
      title: `Advanced ${mainTopic} Concepts`,
      description: `Deep dive into advanced ${mainTopic} techniques and best practices`,
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      type: 'Next Level'
    },
    {
      title: `${mainTopic} Fundamentals`,
      description: `Master the basics of ${mainTopic} with comprehensive tutorials`,
      platform: 'Learning Platform',
      type: 'Foundation'
    },
    {
      title: `${mainTopic} Projects & Examples`,
      description: `Hands-on projects to practice ${mainTopic} skills`,
      platform: 'Tutorial Sites',
      type: 'Practice'
    },
    {
      title: `Related to ${topics[1] || 'Technology'}`,
      description: `Explore complementary topics and technologies`,
      platform: 'Educational Content',
      type: 'Related'
    }
  ];
}