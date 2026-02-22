// ============================================
// SignBridge — Script
// ============================================

var currentLanguage = 'isl';

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

// Prevent special characters in input
$('input').on('keypress', function (e) {
    if (e.keyCode == 13) return true;
    if (e.which < 48 && e.which != 32 ||
        (e.which > 57 && e.which < 65) ||
        (e.which > 90 && e.which < 97) ||
        e.which > 122) {
        e.preventDefault();
    }
});

var wordArray = [];

// Stop link navigation
$('a').click(function (event) {
    event.preventDefault();
});

// Stop form default submit
document.getElementById('form').addEventListener('submit', function (event) {
    event.preventDefault();
});

// Submit handler
document.getElementById('submit').addEventListener('click', function () {
    var input = document.getElementById('text').value;
    if (!input.trim()) return;

    // Show loading state
    document.getElementById('isl_text').textContent = 'Translating...';

    $.ajax({
        url: '/',
        type: 'POST',
        data: {
            text: input,
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
});

// Check for fingerspelled STEM words
function checkForSTEM(words) {
    var badge = document.getElementById('stem-badge');
    var consecutiveLetters = 0;
    var hasSingleLetters = false;

    Object.keys(words).forEach(function (key) {
        if (words[key].length === 1) {
            consecutiveLetters++;
            if (consecutiveLetters >= 3) hasSingleLetters = true;
        } else {
            consecutiveLetters = 0;
        }
    });

    badge.classList.toggle('hidden', !hasSingleLetters);
}

// Display translated text
function display_isl_text(words) {
    var p = document.getElementById('isl_text');
    if (words['_display']) {
        p.textContent = words['_display'];
    } else {
        p.textContent = '';
        Object.keys(words).forEach(function (key) {
            if (key === '_display') return;
            p.textContent += words[key] + ' ';
        });
    }
}

// Show currently playing word
function display_curr_word(word) {
    var section = document.getElementById('now-playing-section');
    section.style.display = 'flex';
    var p = document.querySelector('.curr_word_playing');
    p.textContent = word.toUpperCase();
}

// Hide now playing
function hide_curr_word() {
    var section = document.getElementById('now-playing-section');
    section.style.display = 'none';
}

// Display error
function display_err_message() {
    var p = document.querySelector('.curr_word_playing');
    p.textContent = 'SIGML error — skipping';
    p.style.color = '#ef4444';
}

// Convert JSON to array (skip _display key)
function convert_json_to_arr(words) {
    wordArray = [];
    Object.keys(words).forEach(function (key) {
        if (key !== '_display') {
            wordArray.push(words[key]);
        }
    });
}

// Play each word sequentially
function play_each_word() {
    var totalWords = wordArray.length;
    var i = 0;
    document.getElementById('submit').disabled = true;

    var int = setInterval(function () {
        if (i == totalWords) {
            if (playerAvailableToPlay) {
                clearInterval(int);
                document.getElementById('submit').disabled = false;
                hide_curr_word();
            } else {
                display_err_message();
                document.getElementById('submit').disabled = false;
            }
        } else if (playerAvailableToPlay) {
            playerAvailableToPlay = false;
            startPlayer('SignFiles/' + wordArray[i] + '.sigml');
            display_curr_word(wordArray[i]);
            i++;
        } else {
            var errtext = $('.statusExtra').val();
            if (errtext && errtext.indexOf('invalid') != -1) {
                playerAvailableToPlay = true;
                document.getElementById('submit').disabled = false;
            }
        }
    }, 1000);
}

// Check avatar loaded
var loadingTout = setInterval(function () {
    if (tuavatarLoaded) {
        clearInterval(loadingTout);
        console.log('Avatar loaded successfully!');
    }
}, 1500);
