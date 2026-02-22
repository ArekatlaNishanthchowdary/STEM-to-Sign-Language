import json
import os
import ssl
import re
import ollama

ssl._create_default_https_context = ssl._create_unverified_context
from flask import Flask, request, render_template, send_from_directory, jsonify

app = Flask(__name__, static_folder='static', static_url_path='')

BASE_DIR = os.path.dirname(os.path.realpath(__file__))

# ============================================================
# Configuration
# ============================================================
OLLAMA_MODEL = "llama3.2"

# ============================================================
# Load available vocabulary (words with SIGML animations)
# ============================================================
with open("words.txt", 'r') as f:
    VALID_WORDS = set(w.strip().lower() for w in f.read().strip().split('\n') if w.strip())

print(f"[VOCAB] Loaded {len(VALID_WORDS)} sign vocabulary words")
print(f"[MODEL] Using Ollama model: {OLLAMA_MODEL}")

# ============================================================
# MATH/FORMULA PREPROCESSOR
# ============================================================

# Number to word mapping
NUM_WORDS = {
    '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR',
    '5': 'FIVE', '6': 'SIX', '7': 'SEVEN', '8': 'EIGHT', '9': 'NINE',
    '10': 'TEN', '11': 'ELEVEN', '12': 'TWELVE', '13': 'THIRTEEN',
    '14': 'FOURTEEN', '15': 'FIFTEEN', '16': 'SIXTEEN', '17': 'SEVENTEEN',
    '18': 'EIGHTEEN', '19': 'NINETEEN', '20': 'TWENTY', '30': 'THIRTY',
    '40': 'FORTY', '50': 'FIFTY', '60': 'SIXTY', '70': 'SEVENTY',
    '80': 'EIGHTY', '90': 'NINETY', '100': 'HUNDRED', '1000': 'THOUSAND',
}

# Math operator mapping
MATH_OPS = {
    '+': 'PLUS', '-': 'MINUS', '*': 'TIMES', '×': 'TIMES',
    '/': 'DIVIDE', '÷': 'DIVIDE', '=': 'EQUAL',
    '>': 'GREATER', '<': 'LESS', '>=': 'GREATER EQUAL',
    '<=': 'LESS EQUAL', '!=': 'NOT EQUAL', '≠': 'NOT EQUAL',
    '≥': 'GREATER EQUAL', '≤': 'LESS EQUAL',
    '^': 'POWER', '√': 'SQUARE ROOT', 'π': 'PI',
    '²': 'SQUARE', '³': 'CUBE',
    '(': 'OPEN PAREN', ')': 'CLOSE PAREN',
}

# Common chemical formulas
CHEM_FORMULAS = {
    'h2o': 'H TWO O', 'co2': 'C O TWO', 'o2': 'O TWO',
    'n2': 'N TWO', 'h2': 'H TWO', 'nacl': 'N A C L',
    'h2so4': 'H TWO S O FOUR', 'hcl': 'H C L',
    'naoh': 'N A O H', 'ch4': 'C H FOUR', 'nh3': 'N H THREE',
    'c6h12o6': 'C SIX H TWELVE O SIX', 'fe2o3': 'F E TWO O THREE',
    'caco3': 'C A C O THREE', 'no2': 'N O TWO',
}


def number_to_words(num_str):
    """Convert a number string to sign-friendly words"""
    if num_str in NUM_WORDS:
        return NUM_WORDS[num_str]
    
    try:
        num = int(num_str)
        if num < 0:
            return 'MINUS ' + number_to_words(str(abs(num)))
        if num <= 20:
            return NUM_WORDS.get(str(num), ' '.join(NUM_WORDS.get(d, d) for d in num_str))
        if num < 100:
            tens = (num // 10) * 10
            ones = num % 10
            if ones == 0:
                return NUM_WORDS.get(str(tens), str(num))
            return NUM_WORDS.get(str(tens), '') + ' ' + NUM_WORDS.get(str(ones), '')
        if num < 1000:
            hundreds = num // 100
            remainder = num % 100
            result = NUM_WORDS[str(hundreds)] + ' HUNDRED'
            if remainder > 0:
                result += ' ' + number_to_words(str(remainder))
            return result
        # For larger numbers, spell digit by digit
        return ' '.join(NUM_WORDS.get(d, d) for d in num_str)
    except ValueError:
        # Decimal number
        if '.' in num_str:
            parts = num_str.split('.')
            whole = number_to_words(parts[0])
            decimal = ' '.join(NUM_WORDS.get(d, d) for d in parts[1])
            return whole + ' POINT ' + decimal
        return ' '.join(NUM_WORDS.get(d, d) for d in num_str)


def preprocess_math(text):
    """Convert math expressions, formulas, and numbers to sign-friendly words BEFORE sending to LLM"""
    
    # 1. Handle known chemical formulas first
    for formula, expansion in CHEM_FORMULAS.items():
        pattern = re.compile(re.escape(formula), re.IGNORECASE)
        text = pattern.sub(expansion, text)
    
    # 2. Handle coefficients like 2ab -> TWO A B
    # Do this BEFORE exponents to handle things like 2a^2
    def expand_coefficients(match):
        num = match.group(1)
        vars = match.group(2)
        expanded_vars = ' '.join(list(vars.upper()))
        return f" {number_to_words(num)} {expanded_vars} "
    
    text = re.sub(r'(\d+)([a-zA-Z]+)', expand_coefficients, text)
    
    # 3. Handle exponents like a2, b2, x2, (a+b)2 -> A SQUARE
    # This handles both a2 and )2
    def expand_exponents(match):
        base = match.group(1)
        exp = match.group(2)
        if base.isalpha():
            base = base.upper()
        
        word = ""
        if exp == '2': word = "SQUARE"
        elif exp == '3': word = "CUBE"
        else: word = f"POWER {number_to_words(exp)}"
        
        return f" {base} {word} "
    
    # Match [a-zA-Z] or [)] followed by a number
    text = re.sub(r'([a-zA-Z]|\))(\d+)', expand_exponents, text)
    
    # 4. Uppercase all remaining single letters (variables)
    text = re.sub(r'\b[a-z]\b', lambda m: m.group(0).upper(), text)
    
    # 5. Replace specific symbols/operators with words
    for op, word in sorted(MATH_OPS.items(), key=lambda x: -len(x[0])):
        text = text.replace(op, f' {word} ')
    
    # 6. Convert remaining numbers to words
    def replace_remaining_numbers(match):
        return ' ' + number_to_words(match.group(0)) + ' '
    
    text = re.sub(r'\b\d+\.?\d*\b', replace_remaining_numbers, text)
    
    # Clean up extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


# ============================================================
# LLM-BASED SIGN LANGUAGE GLOSS CONVERSION
# ============================================================

def get_relevant_vocab(text):
    """Get vocab words relevant to the input text to keep prompt small"""
    text_words = set(w.lower() for w in re.split(r'\W+', text) if w)
    relevant = set()
    for vw in VALID_WORDS:
        if vw in text_words or any(vw.startswith(tw[:4]) for tw in text_words if len(tw) >= 4):
            relevant.add(vw)
    # Always include common words and math terms
    common = {'i', 'you', 'he', 'she', 'we', 'they', 'it', 'my', 'your', 'what', 'where',
              'when', 'who', 'why', 'how', 'have', 'go', 'know', 'think', 'say', 
              'water', 'time', 'help', 'because', 'plus', 'minus', 'times', 'divide', 
              'equal', 'square', 'cube', 'power', 'open', 'close', 'paren', 'zero',
              'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'}
    relevant.update(common & VALID_WORDS)
    return sorted(relevant)


def build_gloss_prompt(text, language="isl"):
    """Build a concise prompt for Llama 3.2 to convert STEM English to sign gloss"""
    
    # Include the FULL vocabulary for maximum translation accuracy
    vocab_list = ', '.join(sorted(VALID_WORDS))
    
    prompt = f"""Task: English -> STEM Sign Language Gloss

Guidelines:
- Output ONLY uppercase words separated by spaces.
- Math Symbols: (+) PLUS, (-) MINUS, (=) EQUAL, (*) TIMES, (/) DIVIDE.
- Exponents: a2 -> A SQUARE, b3 -> B CUBE, (a+b)2 -> OPEN PAREN A PLUS B CLOSE PAREN SQUARE.
- Chemistry: H2O -> H TWO O, CO2 -> C O TWO.
- Technical terms not in vocab: keep as-is (Fingerspelling).
- Grammar: Simplify (No THE, A, IS, TO).

Examples:
"the formula for water is H2O" -> WATER FORMULA H TWO O
"(a+b)2 = a2 + 2ab + b2" -> OPEN PAREN A PLUS B CLOSE PAREN SQUARE EQUAL A SQUARE PLUS TWO A B PLUS B SQUARE
"F = m * a" -> F EQUAL M TIMES A

Vocab: {vocab_list}

Text: {text}
Gloss:"""

    return prompt


def llm_to_gloss(text, language="isl"):
    """Use Ollama/Llama 3.2 to convert English/STEM text to sign language gloss"""
    
    try:
        # Step 1: Use raw input for the LLM to preserve technical structure
        prompt = build_gloss_prompt(text, language)
        
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert Sign Language translator. You only output UPPERCASE gloss words. You never explain. You handle STEM and Math formulas by expanding them into sign-ready words like PLUS, EQUAL, SQUARE."},
                {"role": "user", "content": prompt}
            ],
            options={
                "temperature": 0.05,
                "num_predict": 150,
                "top_k": 10,
            }
        )
        
        raw = response['message']['content'].strip()
        print(f"[LLM] Raw response: {raw}")
        
        # Parse: take the first non-empty line
        first_line = ""
        for line in raw.split('\n'):
            line = line.strip()
            if line and not line.startswith('(') and not line.startswith('Note'):
                first_line = line
                break
        
        if not first_line:
            first_line = raw.split('\n')[0].strip() if raw else text
        
        # Remove any prefix
        for prefix in ["ASL:", "ISL:", "GLOSS:", "Gloss:", "Output:", "Answer:"]:
            if first_line.upper().startswith(prefix.upper()):
                first_line = first_line[len(prefix):].strip()
        
        # Safety: Apply math preprocessor to the LLM OUTPUT in case it left symbols/digits
        # This converts things like A2 -> A SQUARE, + -> PLUS
        final_gloss_text = preprocess_math(first_line)
        print(f"[RE-PROCESS] '{first_line}' -> '{final_gloss_text}'")
        
        # Remove any remaining non-alpha/non-space characters
        cleaned = re.sub(r'[^a-zA-Z\s]', ' ', final_gloss_text)
        
        # Split and uppercase
        gloss_words = [w.upper() for w in cleaned.split() if w.strip()]
        
        if gloss_words:
            print(f"[LLM] Parsed gloss: {gloss_words}")
            return gloss_words
    
    except Exception as e:
        print(f"[LLM ERROR] {e}")
    
    # Fallback: use preprocessed input with stop word removal
    print("[FALLBACK] Using preprocessed input with stop word removal")
    processed_input = preprocess_math(text)
    stop = {'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
            'do', 'does', 'did', 'will', 'would', 'can', 'could', 'shall', 'should',
            'may', 'might', 'must', 'have', 'has', 'had', 'to', 'of', 'for', 'it'}
    words = processed_input.split()
    result = [w.upper() for w in words if w.strip() and w.lower() not in stop]
    return result if result else [w.upper() for w in text.split() if w.isalpha()]


# ============================================================
# SIGML FILE MATCHING
# ============================================================

def match_to_sigml(gloss_words):
    """Match gloss words to SIGML files, fingerspell unknowns"""
    result = []
    for word in gloss_words:
        word_lower = word.lower()
        if word_lower in VALID_WORDS:
            result.append(word_lower)
        else:
            # Fingerspell: each letter becomes a separate sign
            for letter in word_lower:
                if letter.isalpha():
                    result.append(letter)
    return result


# ============================================================
# FLASK ROUTES
# ============================================================

final_words_dict = {}

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'GET':
        return render_template('index.html')
    
    # POST - translate text
    global final_words_dict
    final_words_dict = {}
    
    text = request.form.get('text')
    language = request.form.get('language', 'isl')
    
    print(f"\n{'='*50}")
    print(f"Input: {text} | Language: {language}")
    print(f"{'='*50}")
    
    if not text or text.strip() == "":
        return ""
    
    # Step 1: LLM converts English → Sign Language Gloss (with math preprocessing)
    gloss_words = llm_to_gloss(text.strip(), language)
    
    # Step 2: Match gloss words to SIGML files
    sigml_sequence = match_to_sigml(gloss_words)
    
    print(f"[SIGML] Sequence: {sigml_sequence}")
    
    # Build response dict with STRING keys
    for i, word in enumerate(sigml_sequence, start=1):
        final_words_dict[str(i)] = word
    
    # Uppercase single letters for fingerspelling
    for key in list(final_words_dict.keys()):
        if key != '_display' and len(final_words_dict[key]) == 1:
            final_words_dict[key] = final_words_dict[key].upper()
    
    # Add display text with proper word spacing
    display_parts = []
    for word in gloss_words:
        word_lower = word.lower()
        if word_lower in VALID_WORDS:
            display_parts.append(word.upper())
        else:
            display_parts.append('-'.join(word.upper()))
    final_words_dict['_display'] = ' '.join(display_parts)
    
    print(f"[DISPLAY] {final_words_dict['_display']}")
    print(f"[OUTPUT] {final_words_dict}")
    return jsonify(final_words_dict)


@app.route('/static/<path:path>')
def serve_signfiles(path):
    return send_from_directory('static', path)


if __name__ == "__main__":
    print(f"[SERVER] Starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0')
