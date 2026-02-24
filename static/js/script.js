// ============================================
// SignBridge — Full Script (All 6 Features)
// ============================================

var currentLanguage = 'isl';
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
// STEM Badge Detection
// ============================================

function checkForSTEM(words) {
    var badge = document.getElementById('stem-badge');
    var consecutiveLetters = 0;
    var hasSingleLetters = false;

    Object.keys(words).forEach(function (key) {
        if (key === '_display') return;
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
            if (key === '_display') return;
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
        if (key !== '_display') {
            wordArray.push(words[key]);
        }
    });
}

function play_each_word() {
    var totalWords = wordArray.length;
    currentWordIndex = 0;
    isPaused = false;
    updatePauseButton();

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
            if (playerAvailableToPlay) {
                clearInterval(playbackInterval);
                if (playbackWatchdog) clearTimeout(playbackWatchdog);
                playbackInterval = null;
                document.getElementById('submit').disabled = false;
                hide_curr_word();
            } else {
                // If we're at the end but still waiting, show error but allow finish
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
                startPlayer('SignFiles/' + wordArray[currentWordIndex] + '.sigml');
                display_curr_word(wordArray[currentWordIndex]);
                highlightCurrentWord(currentWordIndex);
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
    const submitBtn = document.getElementById('submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            for (let i = 0; i < 8; i++) {
                const particle = document.createElement('div');
                particle.style.cssText = `position:fixed;width:5px;height:5px;background:#FFD600;border-radius:50%;pointer-events:none;z-index:99999;left:${e.clientX}px;top:${e.clientY}px;`;
                document.body.appendChild(particle);

                const angle = (Math.PI * 2 * i) / 8;
                const v = 50 + Math.random() * 60;

                if (window.gsap) {
                    gsap.to(particle, {
                        x: Math.cos(angle) * v,
                        y: Math.sin(angle) * v,
                        opacity: 0, scale: 0,
                        duration: 0.5,
                        ease: 'power3.out',
                        onComplete: () => particle.remove()
                    });
                } else {
                    setTimeout(() => particle.remove(), 600);
                }
            }
        });
    }
});

