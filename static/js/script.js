// ============================================
// SignBridge — Full Script (All 6 Features)
// ============================================

var currentLanguage = 'asl';
var wordArray = [];
var playbackSpeed = 1;
var isPaused = false;
var playbackInterval = null;
var currentWordIndex = 0;
var topicModeEnabled = false;
var structuredData = null;
var lastTranslationInput = '';
var lastGlossDisplay = '';
var activeRecognition = null;
var galleryFrames = [];
var galleryCaptureCount = 0;
var lightboxIndex = 0;
var currentFormulaInput = '';
var currentFormulaKey = '';
var conceptStepsData = [];

// Sign Learning Challenge state
var currentLearnCategory = '';
var learnWords = [];
var currentLearnIndex = 0;
var quizQuestions = [];
var currentQuizIndex = 0;
var currentQuizScore = 0;
var quizCorrectIndex = -1;
var quizAnswered = false;
var quizCategoryName = '';

// Paragraph Mode state
var paragraphSentences = [];
var paragraphResults = [];
var currentSentenceIndex = 0;
var autoplayEnabled = false;

// ============================================
// Voice Input (Web Speech API)
// ============================================

function startVoiceInput(targetId) {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
        return;
    }

    // If already listening, stop
    if (activeRecognition) {
        activeRecognition.stop();
        activeRecognition = null;
        document.querySelectorAll('.btn-mic').forEach(function (b) { b.classList.remove('mic-active'); });
        return;
    }

    var recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    var targetEl = document.getElementById(targetId);
    var micBtn = targetId === 'text' ? document.getElementById('btn-mic-text') : document.getElementById('btn-mic-doubt');

    micBtn.classList.add('mic-active');
    activeRecognition = recognition;

    recognition.onresult = function (event) {
        var transcript = '';
        for (var i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        targetEl.value = transcript;
    };

    recognition.onend = function () {
        micBtn.classList.remove('mic-active');
        activeRecognition = null;
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error:', event.error);
        micBtn.classList.remove('mic-active');
        activeRecognition = null;
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone permission.');
        }
    };

    recognition.start();
}

// ============================================
// Language Toggle
// ============================================

function setLanguage(lang) {
    currentLanguage = lang;
    document.getElementById('btn-isl').classList.toggle('active', lang === 'isl');
    document.getElementById('btn-asl').classList.toggle('active', lang === 'asl');

    var label = document.getElementById('language-label');
    var outputLabel = document.getElementById('output-label');
    if (lang === 'isl') {
        label.textContent = 'Indian Sign Language';
        outputLabel.textContent = 'ISL';
    } else {
        label.textContent = 'American Sign Language';
        outputLabel.textContent = 'ASL';
    }
}

// ============================================
// Input Mode Switching (Text / File Upload)
// ============================================

function switchInputMode(mode) {
    document.querySelectorAll('.mode-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    document.getElementById('text-input-section').style.display = mode === 'text' ? 'block' : 'none';
    document.getElementById('upload-section').style.display = mode === 'upload' ? 'block' : 'none';
    document.getElementById('doubt-section').style.display = mode === 'doubt' ? 'block' : 'none';
    document.getElementById('quiz-section').style.display = mode === 'quiz' ? 'block' : 'none';

    if (mode === 'quiz') {
        loadCategories();
    }
}

// ============================================
// File Upload (Drag & Drop + Click)
// ============================================

(function initUpload() {
    document.addEventListener('DOMContentLoaded', function () {
        var dropZone = document.getElementById('drop-zone');
        var fileInput = document.getElementById('file-input');

        if (!dropZone || !fileInput) return;

        // Click to browse
        dropZone.addEventListener('click', function () {
            fileInput.click();
        });

        // File selected
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                uploadFile(fileInput.files[0]);
            }
        });

        // Drag events
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                uploadFile(e.dataTransfer.files[0]);
            }
        });
    });
})();

function uploadFile(file) {
    var dropZone = document.getElementById('drop-zone');
    var preview = document.getElementById('file-preview');
    var fileName = document.getElementById('file-name');
    var extractedText = document.getElementById('extracted-text');

    // Show loading
    dropZone.querySelector('.drop-zone-text').textContent = 'Processing...';
    dropZone.querySelector('.drop-zone-icon').textContent = '⏳';

    var formData = new FormData();
    formData.append('file', file);

    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (res) {
            fileName.textContent = res.filename + ' (' + res.characters + ' chars)';
            extractedText.value = res.text;
            dropZone.style.display = 'none';
            preview.style.display = 'block';
        },
        error: function (xhr) {
            var err = xhr.responseJSON ? xhr.responseJSON.error : 'Upload failed';
            alert(err);
            resetDropZone();
        }
    });
}

function clearFile() {
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'flex';
    document.getElementById('file-input').value = '';
    document.getElementById('extracted-text').value = '';
    resetDropZone();
}

function resetDropZone() {
    var dropZone = document.getElementById('drop-zone');
    dropZone.querySelector('.drop-zone-text').textContent = 'Drag & drop your file here';
    dropZone.querySelector('.drop-zone-icon').textContent = '📁';
}

function translateExtracted() {
    var text = document.getElementById('extracted-text').value.trim();
    if (!text) return;

    // If topic mode is on, structure first
    if (topicModeEnabled) {
        structureAndTranslate(text);
    } else {
        // Put text in the input and submit
        document.getElementById('text').value = text;
        submitTranslation(text);
    }
}

// ============================================
// Doubt Clarification
// ============================================

function askDoubt() {
    var question = document.getElementById('doubt-question').value.trim();
    if (!question) return;

    var btn = document.getElementById('btn-ask-doubt');
    btn.textContent = '⏳ Thinking...';
    btn.disabled = true;

    $.ajax({
        url: '/ask',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            question: question,
            language: currentLanguage
        }),
        success: function (res) {
            // Show the AI answer
            document.getElementById('doubt-answer-text').textContent = res.answer;
            document.getElementById('doubt-answer-box').style.display = 'block';

            // Auto-play the sign language translation
            if (res.translation) {
                display_isl_text(res.translation);
                convert_json_to_arr(res.translation);
                play_each_word();
            }

            btn.textContent = '🧠 Ask & Translate';
            btn.disabled = false;
        },
        error: function (xhr) {
            var err = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to get answer';
            alert(err);
            btn.textContent = '🧠 Ask & Translate';
            btn.disabled = false;
        }
    });
}

function translateDoubtAnswer() {
    var answer = document.getElementById('doubt-answer-text').textContent.trim();
    if (!answer) return;

    // Put the answer text in the input and submit for translation
    document.getElementById('text').value = answer;
    submitTranslation(answer);
}

// ============================================
// Topic-Wise Mode
// ============================================

function toggleTopicMode() {
    topicModeEnabled = document.getElementById('topic-mode-toggle').checked;
    document.getElementById('topic-tabs').style.display = topicModeEnabled ? 'flex' : 'none';
    document.getElementById('topic-content').style.display = topicModeEnabled ? 'block' : 'none';
}

function structureAndTranslate(text) {
    document.getElementById('isl_text').textContent = 'Structuring content...';

    $.ajax({
        url: '/structure',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ text: text }),
        success: function (res) {
            structuredData = res;
            // Show definition tab by default
            selectTopic('definition');
            // Translate the definition first
            submitTranslation(res.definition || text);
        },
        error: function () {
            submitTranslation(text);
        }
    });
}

function selectTopic(topic) {
    document.querySelectorAll('.topic-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.topic === topic);
    });

    var topicText = document.getElementById('topic-text');

    if (structuredData) {
        var content = structuredData[topic] || 'No content for this section.';
        topicText.textContent = content;

        // Translate this topic
        if (content && content !== 'No content for this section.') {
            submitTranslation(content);
        }
    }
}

// ============================================
// Translation Submission
// ============================================

// Prevent form default submit
document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('form');
    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
        });
    }

    var submitBtn = document.getElementById('submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            var input = document.getElementById('text').value;
            if (!input.trim()) return;

            if (topicModeEnabled) {
                structureAndTranslate(input);
            } else {
                submitTranslation(input);
            }
        });
    }
});

function submitTranslation(text) {
    if (!text.trim()) return;

    lastTranslationInput = text;

    // Check if text has multiple sentences
    var sentences = splitIntoSentences(text);
    if (sentences.length > 1) {
        // Paragraph mode
        startParagraphMode(sentences);
        return;
    }

    // Single sentence mode
    document.getElementById('sentence-nav').style.display = 'none';
    paragraphSentences = [];
    paragraphResults = [];
    document.getElementById('isl_text').textContent = 'Translating...';

    $.ajax({
        url: '/',
        type: 'POST',
        data: {
            text: text,
            language: currentLanguage
        },
        success: function (res) {
            convert_json_to_arr(res);
            play_each_word();
            display_isl_text(res);
            checkForSTEM(res);

            // Show "Explain This" button if formula detected
            var btnExplain = document.getElementById('btn-explain');
            if (res._is_formula) {
                currentFormulaInput = res._formula_input || '';
                currentFormulaKey = res._formula_key || '';
                btnExplain.style.display = 'inline-flex';
            } else {
                currentFormulaInput = '';
                currentFormulaKey = '';
                btnExplain.style.display = 'none';
            }

            // Track learning progress
            trackTranslation(wordArray);
            document.getElementById('concept-panel').style.display = 'none';
        },
        error: function (xhr) {
            document.getElementById('isl_text').textContent = 'Error occurred. Please try again.';
            console.error(xhr);
        }
    });
}

// Stop link navigation
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); });
    });
});

// ============================================
// Concept Understanding Mode
// ============================================

function explainConcept() {
    if (!currentFormulaInput) return;

    var panel = document.getElementById('concept-panel');
    var stepsContainer = document.getElementById('concept-steps');
    var title = document.getElementById('concept-title');

    // Show panel with loading state
    panel.style.display = 'block';
    title.textContent = 'Loading explanation...';
    stepsContainer.innerHTML = '<div class="concept-loading"><div class="concept-spinner"></div> Generating step-by-step explanation...</div>';

    // Scroll to panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    $.ajax({
        url: '/explain',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            formula: currentFormulaInput,
            formula_key: currentFormulaKey,
            language: currentLanguage
        }),
        success: function (res) {
            conceptStepsData = res.steps || [];
            title.textContent = res.formula_name || res.formula;

            var html = '';
            res.steps.forEach(function (step, index) {
                var isVariable = step.label.indexOf('means') > -1;
                var stepClass = isVariable ? 'concept-step variable-step' : 'concept-step';

                html += '<div class="' + stepClass + '" id="concept-step-' + index + '">';
                html += '  <div class="step-header">';
                html += '    <span class="step-label">' + step.label + '</span>';
                html += '    <button class="btn-sign-step" onclick="signExplanationStep(' + index + ')" title="Sign this step">🤟 Sign</button>';
                html += '  </div>';
                html += '  <p class="step-text">' + step.text + '</p>';
                html += '  <div class="step-gloss">';
                html += '    <span class="gloss-label">Sign Gloss:</span> ';
                html += '    <span class="gloss-words">' + (step.gloss || '') + '</span>';
                html += '  </div>';
                html += '</div>';
            });

            stepsContainer.innerHTML = html;
        },
        error: function (xhr) {
            var err = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to explain';
            stepsContainer.innerHTML = '<div class="concept-error">❌ ' + err + '</div>';
        }
    });
}

function closeConceptPanel() {
    document.getElementById('concept-panel').style.display = 'none';
}

function signExplanationStep(index) {
    if (!conceptStepsData[index] || !conceptStepsData[index].sigml) return;

    var stepSigml = conceptStepsData[index].sigml;

    // Highlight active step
    document.querySelectorAll('.concept-step').forEach(function (el) {
        el.classList.remove('active-step');
    });
    document.getElementById('concept-step-' + index).classList.add('active-step');

    // Load into avatar
    convert_json_to_arr(stepSigml);
    display_isl_text(stepSigml);
    play_each_word();
}

// ============================================
// STEM Badge Detection
// ============================================

function checkForSTEM(words) {
    var badge = document.getElementById('stem-badge');
    var consecutiveLetters = 0;
    var hasSingleLetters = false;

    Object.keys(words).forEach(function (key) {
        if (key.startsWith('_')) return;
        if (words[key].length === 1) {
            consecutiveLetters++;
            if (consecutiveLetters >= 3) hasSingleLetters = true;
        } else {
            consecutiveLetters = 0;
        }
    });

    badge.classList.toggle('hidden', !hasSingleLetters);
}

// ============================================
// Smart Subtitles & Output Display
// ============================================

function display_isl_text(words) {
    var p = document.getElementById('isl_text');
    if (words['_display']) {
        lastGlossDisplay = words['_display'];
        // Build wordArray-aligned spans
        // wordArray has individual letters for fingerspelled words
        // _display has grouped words like "E-I-N-S-T-E-I-N"
        var displayWords = words['_display'].split(' ');
        var html = '';
        var arrIdx = 0; // tracks position in wordArray

        displayWords.forEach(function (displayWord) {
            // Check if this is a fingerspelled word (letters joined by hyphens)
            var parts = displayWord.split('-');
            var isFingerspelled = parts.length > 1 && parts.every(function (p) { return p.length <= 2; });

            if (isFingerspelled) {
                // Each letter gets its own highlightable span
                html += '<span class="gloss-group">';
                parts.forEach(function (letter, i) {
                    html += '<span class="gloss-word gloss-letter" data-index="' + arrIdx + '">' + letter + '</span>';
                    if (i < parts.length - 1) html += '<span class="gloss-dash">-</span>';
                    arrIdx++;
                });
                html += '</span> ';
            } else {
                // Whole word is one span
                html += '<span class="gloss-word" data-index="' + arrIdx + '">' + displayWord + '</span> ';
                arrIdx++;
            }
        });
        p.innerHTML = html;
    } else {
        p.textContent = '';
        Object.keys(words).forEach(function (key) {
            if (key.startsWith('_')) return;
            p.textContent += words[key] + ' ';
        });
    }
}

function highlightCurrentWord(index) {
    // Remove previous highlights
    document.querySelectorAll('.gloss-word').forEach(function (el) {
        el.classList.remove('highlight');
    });

    // Highlight current
    var current = document.querySelector('.gloss-word[data-index="' + index + '"]');
    if (current) {
        current.classList.add('highlight');
    }

    // Update subtitle overlay
    var subtitleOverlay = document.getElementById('subtitle-overlay');
    var subtitleText = document.getElementById('subtitle-text');
    if (index >= 0 && index < wordArray.length) {
        subtitleOverlay.style.display = 'block';
        subtitleText.textContent = wordArray[index].toUpperCase();
    } else {
        subtitleOverlay.style.display = 'none';
    }
}

function display_curr_word(word) {
    var section = document.getElementById('now-playing-section');
    section.style.display = 'flex';
    var p = document.querySelector('.curr_word_playing');
    p.textContent = word.toUpperCase();
    p.style.color = '';
}

function hide_curr_word() {
    var section = document.getElementById('now-playing-section');
    section.style.display = 'none';
    document.getElementById('subtitle-overlay').style.display = 'none';

    // Remove all highlights
    document.querySelectorAll('.gloss-word').forEach(function (el) {
        el.classList.remove('highlight');
    });
}

function display_err_message() {
    var p = document.querySelector('.curr_word_playing');
    p.textContent = 'SIGML error — skipping';
    p.style.color = '#ef4444';
}

// ============================================
// Word Array & Playback
// ============================================

function convert_json_to_arr(words) {
    wordArray = [];
    Object.keys(words).forEach(function (key) {
        if (!key.startsWith('_')) {
            wordArray.push(words[key]);
        }
    });
}

function play_each_word() {
    var totalWords = wordArray.length;
    currentWordIndex = 0;
    isPaused = false;
    updatePauseButton();
    galleryCaptureCount = 0;

    // Reset gallery for new playback
    galleryFrames = [];
    document.getElementById('sign-gallery').style.display = 'none';
    document.getElementById('gallery-strip').innerHTML = '';
    document.getElementById('gallery-slider-wrapper').style.display = 'none';

    document.getElementById('submit').disabled = true;

    // Clear any existing interval
    if (playbackInterval) clearInterval(playbackInterval);

    var baseInterval = 1200; // Increased to 1.2s for more natural breathing space at 1x
    var interval = baseInterval / playbackSpeed;

    // Sync avatar speed with UI speed
    try {
        if (typeof CWASA !== 'undefined') {
            CWASA.setSpeed(0, playbackSpeed);
        }
    } catch (e) { console.warn("Could not set CWASA speed", e); }

    var playbackWatchdog = null;

    playbackInterval = setInterval(function () {
        if (isPaused) return;

        if (currentWordIndex == totalWords) {
            // Wait for all animations to stop AND all captures to finish
            if (playerAvailableToPlay && galleryCaptureCount === 0) {
                clearInterval(playbackInterval);
                if (playbackWatchdog) clearTimeout(playbackWatchdog);
                playbackInterval = null;
                document.getElementById('submit').disabled = false;
                hide_curr_word();
                // Build gallery after all signs have played and captured
                buildGallery();
            } else if (playerAvailableToPlay && galleryCaptureCount > 0) {
                // Playback finished but captures pending - show status
                document.querySelector('.curr_word_playing').textContent = "SAVING FRAMES...";
            } else {
                // Still waiting for player
                if (currentWordIndex > 0) hide_curr_word();
                display_err_message();
                document.getElementById('submit').disabled = false;
            }
        } else if (playerAvailableToPlay) {
            playerAvailableToPlay = false;

            // Set a watchdog timer (3 seconds) to bail out if player gets stuck
            if (playbackWatchdog) clearTimeout(playbackWatchdog);
            playbackWatchdog = setTimeout(function () {
                if (!playerAvailableToPlay) {
                    console.warn('Watchdog triggered: forcing next word after stall at ' + wordArray[currentWordIndex - 1]);
                    playerAvailableToPlay = true;
                }
            }, 3000);

            try {
                var currentWord = wordArray[currentWordIndex];
                startPlayer('SignFiles/' + currentWord + '.sigml');
                display_curr_word(currentWord);
                highlightCurrentWord(currentWordIndex);

                // Capture frame after a delay to let the sign animation reach peak pose
                galleryCaptureCount++;
                setTimeout(function () {
                    captureFrame(currentWord);
                }, 700);

                currentWordIndex++;
            } catch (err) {
                console.error('Player start error:', err);
                playerAvailableToPlay = true;
                display_err_message();
            }
        } else {
            var errtext = $('.statusExtra').val();
            if (errtext && (errtext.indexOf('invalid') != -1 || errtext.indexOf('error') != -1)) {
                console.warn('Player reported error status. Skipping...');
                playerAvailableToPlay = true;
                if (playbackWatchdog) clearTimeout(playbackWatchdog);
            }
        }
    }, interval);
}

// ============================================
// Sign Frame Gallery — Capture & Display
// ============================================

function captureFrame(word) {
    try {
        // Find the WebGL canvas inside the CWASA avatar container
        var canvas = document.querySelector('.CWASAAvatar canvas');
        if (!canvas) {
            console.warn('[Gallery] No canvas found for frame capture');
            galleryCaptureCount = Math.max(0, galleryCaptureCount - 1);
            return;
        }
        var dataUrl = canvas.toDataURL('image/png');
        galleryFrames.push({
            dataUrl: dataUrl,
            label: word.toUpperCase()
        });
        console.log('[Gallery] Captured frame for: ' + word);
    } catch (e) {
        console.error('[Gallery] Frame capture error:', e);
    } finally {
        galleryCaptureCount = Math.max(0, galleryCaptureCount - 1);
    }
}

function buildGallery() {
    if (galleryFrames.length === 0) return;

    var galleryEl = document.getElementById('sign-gallery');
    var stripEl = document.getElementById('gallery-strip');
    var countEl = document.getElementById('gallery-count');

    stripEl.innerHTML = '';
    countEl.textContent = galleryFrames.length + ' sign' + (galleryFrames.length > 1 ? 's' : '');

    galleryFrames.forEach(function (frame, idx) {
        var thumb = document.createElement('div');
        thumb.className = 'gallery-thumb';
        thumb.onclick = function () { openLightbox(idx); };

        var img = document.createElement('img');
        img.src = frame.dataUrl;
        img.alt = frame.label;

        var label = document.createElement('span');
        label.className = 'gallery-thumb-label';
        label.textContent = frame.label;

        thumb.appendChild(img);
        thumb.appendChild(label);
        stripEl.appendChild(thumb);
    });

    galleryEl.style.display = 'block';

    // Show slider if there are enough frames to overflow (or more than 5 frames)
    var sliderWrapper = document.getElementById('gallery-slider-wrapper');
    var slider = document.getElementById('gallery-slider');
    // small delay to let DOM render
    setTimeout(function () {
        if (stripEl.scrollWidth > stripEl.clientWidth || galleryFrames.length > 5) {
            slider.min = 0;
            slider.max = galleryFrames.length - 1;
            slider.value = 0;
            document.getElementById('gallery-slider-pos').textContent = '1';
            document.getElementById('gallery-slider-total').textContent = galleryFrames.length;
            sliderWrapper.style.display = 'flex';
        } else {
            sliderWrapper.style.display = 'none';
        }
    }, 150);

    // No GSAP entrance animation as requested
    galleryEl.style.opacity = '1';
    galleryEl.style.transform = 'none';
}

function onGallerySlide(value) {
    var strip = document.getElementById('gallery-strip');
    var slider = document.getElementById('gallery-slider');
    var idx = parseInt(value);
    var thumbs = strip.querySelectorAll('.gallery-thumb');

    // Update position label
    document.getElementById('gallery-slider-pos').textContent = idx + 1;

    if (thumbs[idx]) {
        var thumb = thumbs[idx];

        // Calculate scroll position to center the thumb
        // We use offsetLeft which is relative to the strip (since strip is position:relative)
        var scrollPos = thumb.offsetLeft - (strip.offsetWidth / 2) + (thumb.offsetWidth / 2);

        // Safety check for clientWidth (if zero, don't scroll)
        if (strip.clientWidth > 0) {
            // Use 'auto' instead of 'smooth' for slider navigation to make it snappier
            strip.scrollTo({
                left: scrollPos,
                behavior: 'auto'
            });
            // Fallback for immediate response
            strip.scrollLeft = scrollPos;
        }  // Highlight the active thumb
        thumbs.forEach(function (t) { t.classList.remove('gallery-thumb-active'); });
        thumb.classList.add('gallery-thumb-active');
    }
}

// Legacy scrollGallery still works as fallback
function scrollGallery(direction) {
    var strip = document.getElementById('gallery-strip');
    var scrollAmount = 200;
    strip.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ============================================
// Lightbox Viewer
// ============================================

function openLightbox(index) {
    if (galleryFrames.length === 0) return;
    lightboxIndex = index;

    var lightbox = document.getElementById('gallery-lightbox');
    var img = document.getElementById('lightbox-img');
    var label = document.getElementById('lightbox-label');
    var counter = document.getElementById('lightbox-counter');

    img.src = galleryFrames[index].dataUrl;
    label.textContent = galleryFrames[index].label;
    counter.textContent = (index + 1) + ' / ' + galleryFrames.length;

    lightbox.style.display = 'flex';

    // Animate in
    if (window.gsap) {
        gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.25 });
        gsap.fromTo('.lightbox-img', { scale: 0.9 }, { scale: 1, duration: 0.3, ease: 'back.out(1.5)' });
    }
}

function closeLightbox(event) {
    var lightbox = document.getElementById('gallery-lightbox');
    if (window.gsap) {
        gsap.to(lightbox, {
            opacity: 0, duration: 0.2,
            onComplete: function () { lightbox.style.display = 'none'; }
        });
    } else {
        lightbox.style.display = 'none';
    }
}

function navigateLightbox(direction, event) {
    if (event) event.stopPropagation();
    if (galleryFrames.length === 0) return;

    lightboxIndex += direction;
    // Wrap around
    if (lightboxIndex < 0) lightboxIndex = galleryFrames.length - 1;
    if (lightboxIndex >= galleryFrames.length) lightboxIndex = 0;

    var img = document.getElementById('lightbox-img');
    var label = document.getElementById('lightbox-label');
    var counter = document.getElementById('lightbox-counter');

    img.src = galleryFrames[lightboxIndex].dataUrl;
    label.textContent = galleryFrames[lightboxIndex].label;
    counter.textContent = (lightboxIndex + 1) + ' / ' + galleryFrames.length;

    // Quick slide animation
    if (window.gsap) {
        gsap.fromTo('.lightbox-img',
            { x: direction * 30, opacity: 0.5 },
            { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
    }
}

// Keyboard navigation for lightbox
document.addEventListener('keydown', function (e) {
    var lightbox = document.getElementById('gallery-lightbox');
    if (!lightbox || lightbox.style.display === 'none') return;

    if (e.key === 'Escape') {
        closeLightbox();
    } else if (e.key === 'ArrowLeft') {
        navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
        navigateLightbox(1);
    }
});

// ============================================
// Playback Controls
// ============================================

function setSpeed(speed) {
    playbackSpeed = speed;

    document.querySelectorAll('.speed-btn').forEach(function (btn) {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
    });

    // Update player speed immediately
    try {
        if (typeof CWASA !== 'undefined') {
            CWASA.setSpeed(0, speed);
        }
    } catch (e) { console.warn("Error updating CWASA speed", e); }

    // If currently playing, restart with new speed
    if (playbackInterval && wordArray.length > 0) {
        clearInterval(playbackInterval);
        var remaining = wordArray.slice(currentWordIndex);
        var tempArr = wordArray;
        wordArray = remaining;
        currentWordIndex = 0;
        play_each_word();
        wordArray = tempArr;
    }
}

function togglePause() {
    isPaused = !isPaused;
    updatePauseButton();
}

function updatePauseButton() {
    var btn = document.getElementById('btn-pause');
    btn.textContent = isPaused ? '▶️' : '⏸️';
    btn.title = isPaused ? 'Resume' : 'Pause';
}

function repeatAnimation() {
    if (wordArray.length > 0) {
        if (playbackInterval) clearInterval(playbackInterval);
        currentWordIndex = 0;
        isPaused = false;
        updatePauseButton();
        play_each_word();
    }
}

// ============================================
// Export & Save
// ============================================

function saveLessonLocal() {
    if (!lastGlossDisplay) {
        alert('No translation to save. Translate something first!');
        return;
    }

    var lessons = JSON.parse(localStorage.getItem('signbridge_lessons') || '[]');
    var lesson = {
        input: lastTranslationInput,
        language: currentLanguage,
        gloss: lastGlossDisplay,
        structured: structuredData,
        timestamp: new Date().toISOString()
    };
    lessons.unshift(lesson);
    lessons = lessons.slice(0, 50);
    localStorage.setItem('signbridge_lessons', JSON.stringify(lessons));
    alert('✅ Lesson saved locally!');
}

function exportLesson() {
    if (!lastGlossDisplay) {
        alert('No translation to export. Translate something first!');
        return;
    }

    $.ajax({
        url: '/export',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            title: lastTranslationInput.substring(0, 50),
            input_text: lastTranslationInput,
            language: currentLanguage,
            gloss_display: lastGlossDisplay,
            structured: structuredData,
            sigml_sequence: wordArray
        }),
        success: function (res) {
            var blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'lesson_' + Date.now() + '.json';
            a.click();
            URL.revokeObjectURL(url);
        },
        error: function () {
            alert('Export failed. Please try again.');
        }
    });
}

// ============================================
// Translation History
// ============================================

function toggleHistory() {
    var panel = document.getElementById('history-panel');
    var isVisible = panel.style.display !== 'none';

    if (isVisible) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        loadHistory();
    }
}

function loadHistory() {
    $.ajax({
        url: '/history',
        type: 'GET',
        success: function (res) {
            var list = document.getElementById('history-list');
            if (!res || res.length === 0) {
                list.innerHTML = '<p class="history-empty">No translations yet...</p>';
                return;
            }

            var html = '';
            res.forEach(function (item, index) {
                var time = new Date(item.timestamp).toLocaleString();
                html += '<div class="history-item" onclick="replayHistory(' + index + ')">';
                html += '<div class="history-input">' + escapeHtml(item.input.substring(0, 60)) + '</div>';
                html += '<div class="history-gloss">' + escapeHtml(item.display.substring(0, 80)) + '</div>';
                html += '<div class="history-time">' + time + '</div>';
                html += '</div>';
            });
            list.innerHTML = html;
        }
    });
}

function replayHistory(index) {
    $.ajax({
        url: '/history',
        type: 'GET',
        success: function (res) {
            if (res[index]) {
                document.getElementById('text').value = res[index].input;
                switchInputMode('text');
                submitTranslation(res[index].input);
                toggleHistory();
            }
        }
    });
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Avatar Load Check
// ============================================

var loadingTout = setInterval(function () {
    if (tuavatarLoaded) {
        clearInterval(loadingTout);
        console.log('Avatar loaded successfully!');
    }
}, 1500);

// ============================================
// Buttermax-Style Interactive Experience (Optimized)
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // ---- Shared State ----
    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;
    let ticking = false;

    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    // ---- Single RAF Loop for all continuous animations ----
    function tick() {
        // Cursor outline smooth follow
        if (cursorDot && cursorOutline) {
            outlineX += (mouseX - outlineX) * 0.15;
            outlineY += (mouseY - outlineY) * 0.15;
            cursorOutline.style.transform = `translate3d(${outlineX - 22}px, ${outlineY - 22}px, 0)`;
        }
        requestAnimationFrame(tick);
    }
    tick();

    // ---- Mouse Tracking (passive, minimal work) ----
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursorDot) {
            cursorDot.style.transform = `translate3d(${mouseX - 4}px, ${mouseY - 4}px, 0)`;
        }
    }, { passive: true });

    // ---- Cursor Hover State ----
    if (cursorDot && cursorOutline) {
        document.querySelectorAll('button, a, input, select, textarea').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'), { passive: true });
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'), { passive: true });
        });
    }

    // ---- 3D Card Tilt (RAF-throttled) ----
    document.querySelectorAll('.language-selector, .input-section, .output-section, .avatar-card').forEach(card => {
        let tiltRAF = null;

        card.addEventListener('mousemove', (e) => {
            if (tiltRAF) return; // skip if a frame is already pending
            tiltRAF = requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                const rotateX = ((e.clientY - rect.top - rect.height / 2) / rect.height) * -4;
                const rotateY = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 4;
                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                tiltRAF = null;
            });
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
            if (tiltRAF) { cancelAnimationFrame(tiltRAF); tiltRAF = null; }
            card.style.transform = '';
        }, { passive: true });
    });

    // ---- Magnetic Buttons (RAF-throttled) ----
    document.querySelectorAll('.action-btn, .pb-btn').forEach(btn => {
        let magRAF = null;

        btn.addEventListener('mousemove', (e) => {
            if (magRAF) return;
            magRAF = requestAnimationFrame(() => {
                const rect = btn.getBoundingClientRect();
                const dx = (e.clientX - rect.left - rect.width / 2) * 0.15;
                const dy = (e.clientY - rect.top - rect.height / 2) * 0.15;
                btn.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                magRAF = null;
            });
        }, { passive: true });

        btn.addEventListener('mouseleave', () => {
            if (magRAF) { cancelAnimationFrame(magRAF); magRAF = null; }
            btn.style.transform = '';
        }, { passive: true });
    });

    // ---- Text Scramble on Logo (only runs on hover, no perf cost) ----
    const logoH1 = document.querySelector('.logo h1');
    if (logoH1) {
        const originalText = logoH1.textContent;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let scrambleInterval = null;

        logoH1.addEventListener('mouseenter', () => {
            let iteration = 0;
            clearInterval(scrambleInterval);
            scrambleInterval = setInterval(() => {
                logoH1.textContent = originalText.split('').map((char, idx) => {
                    if (idx < iteration) return originalText[idx];
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join('');
                iteration += 0.5;
                if (iteration >= originalText.length) {
                    clearInterval(scrambleInterval);
                    logoH1.textContent = originalText;
                }
            }, 40);
        });
    }

    // ---- GSAP Entrance Animations (one-shot, no ongoing cost) ----
    if (window.gsap) {
        const allAnimated = '.logo-icon, .logo h1, .subtitle, .language-selector, .input-mode-tabs, #text-input-section, .output-section, .avatar-card, .app-footer, .mode-tab';

        const tl = gsap.timeline({
            defaults: { ease: 'power4.out', duration: 0.8 },
            onComplete: () => {
                document.querySelectorAll(allAnimated).forEach(el => {
                    el.style.opacity = '1';
                    el.style.transform = '';
                });
            }
        });

        tl.fromTo('.logo-icon', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, clearProps: 'all' })
            .fromTo('.logo h1', { y: 30, opacity: 0 }, { y: 0, opacity: 1, clearProps: 'all' }, '-=0.3')
            .fromTo('.subtitle', { y: 15, opacity: 0 }, { y: 0, opacity: 1, clearProps: 'all' }, '-=0.5')
            .fromTo('.language-selector', { x: -40, opacity: 0 }, { x: 0, opacity: 1, clearProps: 'all' }, '-=0.4')
            .fromTo('.input-mode-tabs', { x: -30, opacity: 0 }, { x: 0, opacity: 1, clearProps: 'all' }, '-=0.6')
            .fromTo('#text-input-section', { y: 20, opacity: 0 }, { y: 0, opacity: 1, clearProps: 'opacity,transform' }, '-=0.5')
            .fromTo('.output-section', { y: 20, opacity: 0 }, { y: 0, opacity: 1, clearProps: 'all' }, '-=0.6')
            .fromTo('.avatar-card', { x: 40, opacity: 0 }, { x: 0, opacity: 1, clearProps: 'all' }, '-=0.7')
            .fromTo('.app-footer', { opacity: 0 }, { opacity: 1, clearProps: 'all' }, '-=0.4');

        gsap.fromTo('.mode-tab',
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, stagger: 0.08, delay: 0.5, ease: 'back.out(1.5)', clearProps: 'all' }
        );

        // Safety fallback
        setTimeout(() => {
            document.querySelectorAll(allAnimated).forEach(el => {
                el.style.opacity = '1';
                el.style.visibility = 'visible';
            });
        }, 2500);
    }

    // ---- Particle Burst on Submit (lightweight, 8 particles) ----
    // ---- Particle Burst on Submit (reusable function) ----
    const submitBtn = document.getElementById('submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            createParticles(submitBtn);
        });
    }
});

// ============================================
// Sign Learning Challenge Functions
// ============================================

function loadCategories() {
    // Show picker, hide panels
    document.getElementById('quiz-category-picker').style.display = 'block';
    document.getElementById('quiz-learn-panel').style.display = 'none';
    document.getElementById('quiz-test-panel').style.display = 'none';
    document.getElementById('quiz-results-panel').style.display = 'none';

    $.ajax({
        url: '/learn/categories',
        type: 'GET',
        success: function (res) {
            var grid = document.getElementById('category-grid');
            grid.innerHTML = '';
            res.forEach(function (cat) {
                var card = document.createElement('div');
                card.className = 'category-card';
                card.onclick = function () { startLearning(cat.name); };
                card.innerHTML = `
                    <div class="cat-name">${cat.name}</div>
                    <div class="cat-count">${cat.count} words</div>
                `;
                grid.appendChild(card);
            });
        },
        error: function () {
            document.getElementById('category-grid').innerHTML = '<div class="error">Failed to load categories.</div>';
        }
    });
}

function startLearning(category) {
    currentLearnCategory = category;
    quizCategoryName = category;
    currentLearnIndex = 0;

    $.ajax({
        url: '/learn/words',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ category: category }),
        success: function (res) {
            learnWords = res;
            document.getElementById('quiz-category-picker').style.display = 'none';
            document.getElementById('quiz-learn-panel').style.display = 'block';
            document.getElementById('learn-total').textContent = learnWords.length;
            renderLearnWord();
        }
    });
}

function renderLearnWord() {
    var item = learnWords[currentLearnIndex];
    document.getElementById('learn-current').textContent = currentLearnIndex + 1;
    document.getElementById('learn-word-text').textContent = item.word.toUpperCase();

    // Play the sign
    convert_json_to_arr(item.sigml);
    play_each_word();
}

function replayLearnWord() {
    if (learnWords[currentLearnIndex]) {
        convert_json_to_arr(learnWords[currentLearnIndex].sigml);
        play_each_word();
    }
}

function nextLearnWord() {
    currentLearnIndex++;
    if (currentLearnIndex < learnWords.length) {
        renderLearnWord();
    } else {
        // All words learned, move to Quiz
        startQuiz();
    }
}

function backToCategories() {
    loadCategories();
}

function startQuiz() {
    currentQuizIndex = 0;
    currentQuizScore = 0;

    document.getElementById('quiz-learn-panel').style.display = 'none';
    document.getElementById('quiz-test-panel').style.display = 'block';
    document.getElementById('quiz-total').textContent = '5'; // We do 5 questions

    loadQuizQuestion();
}

function loadQuizQuestion() {
    quizAnswered = false;
    document.getElementById('quiz-current').textContent = currentQuizIndex + 1;
    document.getElementById('quiz-score-num').textContent = currentQuizScore;
    document.getElementById('quiz-test-feedback').style.display = 'none';
    document.getElementById('btn-quiz-next-q').style.display = 'none';

    // Reset option states
    document.querySelectorAll('.quiz-option').forEach(btn => {
        btn.className = 'quiz-option';
        btn.disabled = false;
    });

    $.ajax({
        url: '/learn/quiz',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ category: quizCategoryName }),
        success: function (res) {
            quizCorrectIndex = res.correct_index;
            quizSigml = res.sigml;

            var options = document.querySelectorAll('.quiz-option');
            res.options.forEach((opt, i) => {
                options[i].textContent = opt.toUpperCase();
            });

            // Play the sign
            convert_json_to_arr(res.sigml);
            play_each_word();
        }
    });
}

function replayQuizWord() {
    if (quizSigml) {
        convert_json_to_arr(quizSigml);
        play_each_word();
    }
}

function selectQuizOption(index) {
    if (quizAnswered) return;
    quizAnswered = true;

    var feedback = document.getElementById('quiz-test-feedback');
    feedback.style.display = 'block';

    var options = document.querySelectorAll('.quiz-option');
    options.forEach(btn => btn.disabled = true);

    if (index === quizCorrectIndex) {
        currentQuizScore++;
        options[index].classList.add('correct');
        feedback.className = 'quiz-test-feedback quiz-correct';
        feedback.innerHTML = '🎉 Correct!';

        // 5. Secondary effects
        try {
            createParticles(options[index]);
        } catch (e) {
            console.error("Particle error:", e);
        }
    } else {
        options[index].classList.add('wrong');
        options[quizCorrectIndex].classList.add('correct');
        feedback.className = 'quiz-test-feedback quiz-wrong';
        feedback.innerHTML = '❌ Not quite. This is the sign for: <strong>' + options[quizCorrectIndex].textContent + '</strong>';

        // Replay correct sign so they learn
        setTimeout(replayQuizWord, 500);
    }

    // 6. Update core UI
    document.getElementById('quiz-score-num').textContent = currentQuizScore;
    document.getElementById('btn-quiz-next-q').style.display = 'block';
}

function nextQuizQuestion() {
    currentQuizIndex++;
    if (currentQuizIndex < 5) {
        loadQuizQuestion();
    } else {
        showQuizResults();
    }
}

function showQuizResults() {
    document.getElementById('quiz-test-panel').style.display = 'none';
    document.getElementById('quiz-results-panel').style.display = 'block';

    document.getElementById('results-score-final').textContent = currentQuizScore;
    document.getElementById('results-total-final').textContent = '5';

    var msg = "Great job!";
    if (currentQuizScore === 5) msg = "Perfect Score! You're a natural sign language user! 🏅";
    else if (currentQuizScore >= 3) msg = "Well done! You have a good memory for signs. 🌟";
    else msg = "Good effort! Keep practicing and you'll get them all next time. 📚";

    document.getElementById('results-message').textContent = msg;

    // Track in original learning progress too
    trackQuizResult(currentQuizScore >= 4, currentQuizScore * 10, currentQuizScore);
}

function restartCategory() {
    startLearning(quizCategoryName);
}

// Reusable particle effect for buttons
function createParticles(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `position:fixed;width:6px;height:6px;background:#FFD600;border-radius:50%;pointer-events:none;z-index:99999;left:${x}px;top:${y}px;`;
        document.body.appendChild(particle);

        const angle = (Math.PI * 2 * i) / 12;
        const v = 60 + Math.random() * 80;

        if (window.gsap) {
            gsap.to(particle, {
                x: Math.cos(angle) * v,
                y: Math.sin(angle) * v,
                opacity: 0, scale: 0,
                duration: 0.6,
                ease: 'power3.out',
                onComplete: () => particle.remove()
            });
        } else {
            setTimeout(() => particle.remove(), 600);
        }
    }
}

// ============================================
// Learning Progress Tracking
// ============================================

function getProgress() {
    var data = localStorage.getItem('signbridge_progress');
    if (data) {
        return JSON.parse(data);
    }
    return {
        translations: 0,
        wordsLearned: [],
        quizPlayed: 0,
        quizCorrect: 0,
        bestStreak: 0,
        totalScore: 0,
        recentWords: []
    };
}

function saveProgress(progress) {
    localStorage.setItem('signbridge_progress', JSON.stringify(progress));
}

function trackTranslation(words) {
    var progress = getProgress();
    progress.translations++;

    // Track unique words learned
    words.forEach(function (word) {
        if (word && word.length > 1 && progress.wordsLearned.indexOf(word.toLowerCase()) === -1) {
            progress.wordsLearned.push(word.toLowerCase());
        }
    });

    // Track recent words (last 30)
    words.forEach(function (word) {
        if (word && word.length > 1) {
            // Remove duplicates, add to front
            progress.recentWords = progress.recentWords.filter(function (w) { return w !== word.toLowerCase(); });
            progress.recentWords.unshift(word.toLowerCase());
        }
    });
    if (progress.recentWords.length > 30) {
        progress.recentWords = progress.recentWords.slice(0, 30);
    }

    saveProgress(progress);
}

function trackQuizResult(correct, score, streak) {
    var progress = getProgress();
    progress.quizPlayed++;
    if (correct) progress.quizCorrect++;
    progress.totalScore = score;
    if (streak > progress.bestStreak) progress.bestStreak = streak;
    saveProgress(progress);
}

function toggleProgress() {
    var panel = document.getElementById('progress-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        renderProgress();
    } else {
        panel.style.display = 'none';
    }
}

function renderProgress() {
    var progress = getProgress();

    document.getElementById('stat-translations').textContent = progress.translations;
    document.getElementById('stat-words-learned').textContent = progress.wordsLearned.length;
    document.getElementById('stat-quiz-played').textContent = progress.quizPlayed;
    document.getElementById('stat-quiz-correct').textContent = progress.quizCorrect;
    document.getElementById('stat-best-streak').textContent = progress.bestStreak;
    document.getElementById('stat-total-score').textContent = progress.totalScore;

    // Render recent word chips
    var container = document.getElementById('progress-word-chips');
    if (progress.recentWords.length === 0) {
        container.innerHTML = '<span class="progress-empty">No words yet \u2014 start translating!</span>';
    } else {
        var html = '';
        progress.recentWords.slice(0, 20).forEach(function (word) {
            html += '<span class="progress-chip">' + word.toUpperCase() + '</span>';
        });
        container.innerHTML = html;
    }
}

function resetProgress() {
    if (!confirm('Reset all learning progress? This cannot be undone.')) return;
    localStorage.removeItem('signbridge_progress');
    quizScore = 0;
    quizStreak = 0;
    quizBest = 0;
    document.getElementById('quiz-score').textContent = '0';
    document.getElementById('quiz-streak').textContent = '0 \ud83d\udd25';
    document.getElementById('quiz-best').textContent = '0 \u2b50';
    renderProgress();
}

// ============================================
// Paragraph Mode — Multi-Sentence Translation
// ============================================

function splitIntoSentences(text) {
    // Split on period, exclamation, question mark, or newlines
    var raw = text.split(/(?<=[.!?])\s+|\n+/);
    var sentences = [];
    raw.forEach(function (s) {
        var trimmed = s.trim();
        if (trimmed.length > 0) {
            sentences.push(trimmed);
        }
    });
    return sentences;
}

function startParagraphMode(sentences) {
    paragraphSentences = sentences;
    paragraphResults = new Array(sentences.length).fill(null);
    currentSentenceIndex = 0;

    // Show navigator
    document.getElementById('sentence-nav').style.display = 'flex';
    document.getElementById('sentence-total').textContent = sentences.length;
    updateSentenceNav();

    // Show first sentence info
    document.getElementById('isl_text').textContent = 'Translating sentence 1/' + sentences.length + '...';

    // Translate first sentence
    translateSentenceAt(0);
}

function translateSentenceAt(index) {
    if (index < 0 || index >= paragraphSentences.length) return;

    currentSentenceIndex = index;
    updateSentenceNav();

    // If already translated, just replay
    if (paragraphResults[index]) {
        playSentence(index);
        return;
    }

    document.getElementById('isl_text').textContent = 'Translating sentence ' + (index + 1) + '/' + paragraphSentences.length + '...';

    $.ajax({
        url: '/',
        type: 'POST',
        data: {
            text: paragraphSentences[index],
            language: currentLanguage
        },
        success: function (res) {
            paragraphResults[index] = res;
            playSentence(index);

            // Track
            convert_json_to_arr(res);
            trackTranslation(wordArray);
        },
        error: function () {
            document.getElementById('isl_text').textContent = 'Error translating sentence ' + (index + 1);
        }
    });
}

function playSentence(index) {
    var res = paragraphResults[index];
    if (!res) return;

    convert_json_to_arr(res);
    play_each_word();
    display_isl_text(res);
    checkForSTEM(res);

    // Update UI
    document.getElementById('sentence-current').textContent = index + 1;

    // Auto-advance after playback ends (if autoplay is on)
    if (autoplayEnabled) {
        var totalDuration = wordArray.length * (800 / playbackSpeed) + 1500;
        setTimeout(function () {
            if (autoplayEnabled && currentSentenceIndex < paragraphSentences.length - 1) {
                nextSentence();
            } else {
                autoplayEnabled = false;
                document.getElementById('btn-autoplay').textContent = '▶ Auto';
                document.getElementById('btn-autoplay').classList.remove('autoplay-active');
            }
        }, totalDuration);
    }
}

function prevSentence() {
    if (currentSentenceIndex > 0) {
        translateSentenceAt(currentSentenceIndex - 1);
    }
}

function nextSentence() {
    if (currentSentenceIndex < paragraphSentences.length - 1) {
        translateSentenceAt(currentSentenceIndex + 1);
    }
}

function toggleAutoplay() {
    autoplayEnabled = !autoplayEnabled;
    var btn = document.getElementById('btn-autoplay');
    if (autoplayEnabled) {
        btn.textContent = '⏸ Stop';
        btn.classList.add('autoplay-active');
        // Start playing from current sentence
        if (paragraphResults[currentSentenceIndex]) {
            playSentence(currentSentenceIndex);
        } else {
            translateSentenceAt(currentSentenceIndex);
        }
    } else {
        btn.textContent = '▶ Auto';
        btn.classList.remove('autoplay-active');
    }
}

function updateSentenceNav() {
    document.getElementById('sentence-current').textContent = currentSentenceIndex + 1;
    document.getElementById('btn-prev-sentence').disabled = (currentSentenceIndex <= 0);
    document.getElementById('btn-next-sentence').disabled = (currentSentenceIndex >= paragraphSentences.length - 1);
}

// ============================================
// Feature Tour Walkthrough Logic
// ============================================

var currentTourStep = 0;
const tourSteps = [
    {
        selector: '.app-header',
        title: 'Welcome to SignBridge! 🤟',
        text: 'The most advanced STEM-to-Sign Language translator. Let\'s show you around!',
        pos: 'bottom'
    },
    {
        selector: '.language-selector',
        title: 'Change Language 🇮🇳🇺🇸',
        text: 'Toggle between Indian Sign Language (ISL) and American Sign Language (ASL) grammar.',
        pos: 'bottom'
    },
    {
        selector: '.input-mode-tabs',
        title: 'Choose Input Mode ✏️',
        text: 'You can type text, upload files, ask questions, or take a learning quiz.',
        pos: 'bottom'
    },
    {
        selector: '#text-input-section',
        title: 'STEM Input 🔢',
        text: 'Enter complex STEM content like "Newton\'s Second Law", "H2O + CO2", or "(a+b)²". We handle them all!',
        pos: 'bottom',
        mode: 'text'
    },
    {
        selector: '#upload-section',
        title: 'File Upload 📄',
        text: 'Upload PDF, DOCX, or images. We extract the STEM text and translate it for you!',
        pos: 'bottom',
        mode: 'upload'
    },
    {
        selector: '#doubt-section',
        title: 'Ask a Doubt ❓',
        text: 'Have a question? Ask our AI and get a 10-year-old friendly explanation in sign language.',
        pos: 'bottom',
        mode: 'doubt'
    },
    {
        selector: '#quiz-section',
        title: 'Sign Learning Quiz 🎯',
        text: 'A full immersive experience! Learn signs by category and then test your skills.',
        pos: 'top',
        mode: 'quiz'
    },
    {
        selector: '.output-section',
        title: 'Gloss Translation 📝',
        text: 'See the translated sign language gloss here. We detect STEM concepts automatically!',
        pos: 'left'
    },
    {
        selector: '.avatar-card',
        title: '3D Sign Avatar 🤖',
        text: 'Watch our photorealistic avatar perform your translation in real-time with smooth animations.',
        pos: 'left'
    },
    {
        selector: '.playback-controls',
        title: 'Control Animations ⏩',
        text: 'Adjust the speed, pause, or replay any sign to learn at your own pace.',
        pos: 'top'
    },
    {
        selector: '.topic-mode-section',
        title: 'Smart Topic Mode 📖',
        text: 'Turn this on to automatically split complex STEM text into Definition, Formula, and Examples.',
        pos: 'top'
    },
    {
        selector: '.action-buttons',
        title: 'Save & Track 📊',
        text: 'Save your lessons, view history, or check your performance stats here.',
        pos: 'top'
    },
    {
        selector: '#btn-tour',
        title: 'Finished! 🎓',
        text: 'You\'re all set! You can restart this tour anytime by clicking this button. Happy learning!',
        pos: 'left'
    }
];

function startTour() {
    currentTourStep = 0;
    var overlay = document.getElementById('tour-overlay');
    var spotlight = document.getElementById('tour-spotlight');
    var tooltip = document.getElementById('tour-tooltip');

    overlay.style.display = 'block';
    spotlight.style.display = 'block';
    tooltip.style.display = 'block';
    tooltip.style.opacity = '0';

    // Switch to text mode initially
    switchInputMode('text');

    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.style.opacity = '1'; }, 10);

    setTimeout(function () { showTourStep(0); }, 200);
}

function showTourStep(index) {
    const step = tourSteps[index];

    // Switch mode if needed, then wait for DOM to update
    if (step.mode) {
        switchInputMode(step.mode);
    }

    // Update tooltip content immediately
    document.getElementById('tour-title').innerText = step.title;
    document.getElementById('tour-text').innerText = step.text;
    document.getElementById('tour-step-counter').innerText = `${index + 1} / ${tourSteps.length}`;
    document.getElementById('btn-tour-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
    document.getElementById('btn-tour-next').innerText = index === tourSteps.length - 1 ? 'Finish' : 'Next';

    // Wait for mode switch + scroll to settle, then position
    setTimeout(function () {
        const el = document.querySelector(step.selector);
        if (!el) {
            console.error('Tour element not found:', step.selector);
            return;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { positionTourSpotlight(el, step.pos); }, 350);
    }, 120);
}

function positionTourSpotlight(targetEl, pos) {
    var spotlight = document.getElementById('tour-spotlight');
    var tooltip = document.getElementById('tour-tooltip');
    var rect = targetEl.getBoundingClientRect();
    var padding = 10;

    // Position spotlight exactly over the element (viewport-relative = fixed position)
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = (rect.height + padding * 2) + 'px';

    // Now position the tooltip next to the spotlight
    tooltip.setAttribute('data-pos', pos);
    var tw = tooltip.offsetWidth || 320;
    var th = tooltip.offsetHeight || 200;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var GAP = 20;
    var toolTop, toolLeft;

    if (pos === 'bottom') {
        toolTop = rect.bottom + GAP;
        toolLeft = rect.left + rect.width / 2 - tw / 2;
    } else if (pos === 'top') {
        toolTop = rect.top - th - GAP;
        toolLeft = rect.left + rect.width / 2 - tw / 2;
    } else if (pos === 'left') {
        toolTop = rect.top + rect.height / 2 - th / 2;
        toolLeft = rect.left - tw - GAP;
    } else { // right
        toolTop = rect.top + rect.height / 2 - th / 2;
        toolLeft = rect.right + GAP;
    }

    // Smart boundary clamping
    if (toolLeft < 10) toolLeft = 10;
    if (toolLeft + tw > vw - 10) toolLeft = vw - tw - 10;
    if (toolTop < 10) toolTop = 10;
    if (toolTop + th > vh - 10) toolTop = vh - th - 10;

    tooltip.style.position = 'fixed';
    tooltip.style.top = toolTop + 'px';
    tooltip.style.left = toolLeft + 'px';

    // Animate tooltip in
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(12px)';
    tooltip.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    requestAnimationFrame(function () {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    });
}

function nextTourStep() {
    if (currentTourStep < tourSteps.length - 1) {
        currentTourStep++;
        showTourStep(currentTourStep);
    } else {
        endTour();
    }
}

function prevTourStep() {
    if (currentTourStep > 0) {
        currentTourStep--;
        showTourStep(currentTourStep);
    }
}

function endTour() {
    var overlay = document.getElementById('tour-overlay');
    var spotlight = document.getElementById('tour-spotlight');
    var tooltip = document.getElementById('tour-tooltip');

    // Fade out
    overlay.style.transition = 'opacity 0.3s ease';
    spotlight.style.transition = 'opacity 0.3s ease';
    tooltip.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    spotlight.style.opacity = '0';
    tooltip.style.opacity = '0';

    // Hide & reset after animation
    setTimeout(function () {
        overlay.style.display = 'none';
        spotlight.style.display = 'none';
        tooltip.style.display = 'none';
        // Reset inline styles so they're clean for next tour
        overlay.style.opacity = '';
        spotlight.style.opacity = '';
        tooltip.style.opacity = '';
        tooltip.style.transform = '';
    }, 350);

    // Restore default input mode
    switchInputMode('text');
}

// Global escape key listener for tour
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        endTour();
    }
});

