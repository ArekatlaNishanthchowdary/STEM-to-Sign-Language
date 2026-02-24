import json
import os
import ssl
import re
import datetime
import urllib.request

ssl._create_default_https_context = ssl._create_unverified_context

from dotenv import load_dotenv
from flask import Flask, request, render_template, send_from_directory, jsonify
from groq import Groq
from werkzeug.utils import secure_filename

from utils.extraction import extract_text

load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

BASE_DIR = os.path.dirname(os.path.realpath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
HISTORY_FILE = os.path.join(BASE_DIR, 'history.json')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}

def allowed_file(filename):
    """Check if the file extension is supported."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ============================================================
# Configuration
# ============================================================
GROQ_MODEL = "llama-3.3-70b-versatile"
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

print(f"[MODEL] Using Groq model: {GROQ_MODEL}")

# ============================================================
# Load available vocabulary (words with SIGML animations)
# ============================================================
with open("words.txt", 'r') as f:
    VALID_WORDS = set(w.strip().lower() for w in f.read().strip().split('\n') if w.strip())

print(f"[VOCAB] Loaded {len(VALID_WORDS)} sign vocabulary words")

# ============================================================
# Synonym Mapping
# ============================================================
SYNONYM_MAP = {
    # Greetings & Basics
    "HI": "HELLO", "HEY": "HELLO", "GREETINGS": "HELLO",
    "THANKS": "THANKYOU", "THANK": "THANKYOU",
    "OK": "AGREE", "OKAY": "AGREE", "YES": "AGREE", "YESP": "AGREE",
    "NO": "CANCEL", "NOT": "CANCEL", "NEGATIVE": "CANCEL",
    "AWESOME": "GOOD", "GREAT": "GOOD", "FANTASTIC": "GOOD", "NICE": "GOOD", "HAPPY": "GOOD",
    "BYE": "BYE", "GOODBYE": "BYE", "FAREWELL": "BYE",
    
    # Adjectives/Opposites
    "FAST": "QUICK", "RAPID": "QUICK", "SPEEDY": "QUICK",
    "LARGE": "BIG", "HUGE": "BIG", "GIANT": "BIG", "MASSIVE": "BIG",
    "SMALL": "LITTLE", "TINY": "LITTLE", "MINI": "LITTLE",
    "SAD": "BAD", "UPSET": "BAD", "REJECT": "BAD",
    "BEAUTIFUL": "BEAUTIFUL", "PRETTY": "BEAUTIFUL", "LOVELY": "BEAUTIFUL",
    "DIFFICULT": "DIFFICULT", "HARD": "DIFFICULT", "TOUGH": "DIFFICULT",
    "EASY": "EASY", "SIMPLE": "EASY",
    
    # People & Roles
    "INSTRUCTOR": "TEACHER", "PROFESSOR": "TEACHER", "LECTURER": "TEACHER",
    "STUDENT": "CHILD", "PUPIL": "CHILD", "LEARNER": "CHILD",
    "PHYSICIAN": "DOCTOR", "SURGEON": "DOCTOR", "CLINIC": "DOCTOR",
    "ENGINEER": "ENGINEER", "MECHANIC": "ENGINEER",
    "CARPENTER": "CARPENTER", "COBBLER": "COBBLER",
    "MAN": "MAN", "MALE": "MAN", "GUY": "MAN",
    "GIRL": "GIRL", "WOMAN": "GIRL", "FEMALE": "GIRL",
    
    # Objects & Places
    "AUTO": "CAR", "VEHICLE": "CAR", "CAB": "CAR", "TAXI": "TAXI",
    "AEROPLANE": "AEROPLANE", "PLANE": "AEROPLANE", "FLIGHT": "AEROPLANE",
    "BICYCLE": "CYCLE", "BIKE": "CYCLE", "MOTORCYCLE": "CYCLE",
    "HOUSE": "HOME", "RESIDENCE": "HOME", "FLAT": "HOME",
    "OFFICE": "OFFICE", "CABINET": "ALMIRAH",
    "CHAIR": "CHAIR", "SEAT": "CHAIR", "BENCH": "BENCH",
    "BOOK": "BOOK", "READ": "READ", "NOVEL": "BOOK",
    "PEN": "PEN", "PENCIL": "PEN", "WRITE": "WRITE",
    
    # Verbs/Actions
    "START": "BEGIN", "INITIATE": "BEGIN",
    "STOP": "FINISH", "END": "FINISH", "DONE": "FINISH", "COMPLETE": "FINISH",
    "TRUE": "CORRECT", "RIGHT": "CORRECT",
    "FALSE": "MISTAKE", "WRONG": "MISTAKE", "ERROR": "MISTAKE",
    "RUN": "RUN", "JUMP": "JUMP", "DANCE": "DANCE",
    "EAT": "EAT", "DRINK": "DRINKING", "FOOD": "FOOD",
    "SLEEP": "NIGHT", "BED": "NIGHT",
    "TEACH": "TEACH", "LEARN": "LEARN",
    "UNDERSTAND": "UNDERSTAND", "KNOW": "KNOW",
    "HAVE": "GET", "HAS": "GET", "HAD": "GET", "POSSESS": "GET", "OWN": "GET",
    "SHE": "GIRL", "IT": "THAT",
    "ASK": "questions", "BELIEVE": "THINK", "BECAUSE": "REASON",
    "CRUCIAL": "important", "SIGNIFICANT": "important", "ESSENTIAL": "important",
    
    # Time & Date
    "TODAY": "TODAY", "NOW": "NOW", "CURRENT": "NOW",
    "TOMORROW": "TOMORROW", "YESTERDAY": "BEFORE",
    "MORNING": "MORNING", "AFTERNOON": "AFTERNOON", "EVENING": "EVENING", "NIGHT": "NIGHT",
    "MONDAY": "MONDAY", "TUESDAY": "TUESDAY",
    "THURSDAY": "THURSDAY", "FRIDAY": "FRIDAY", "SUNDAY": "SUNDAY",
    
    # STEM Specific
    "PROBLEM": "PROBLEM", "ISSUE": "PROBLEM",
    "QUESTION": "QUESTION",
    
    # === NEW: 61 STEM Words with confirmed SIGML files ===
    # Science & Chemistry
    "CHEMISTRY": "CHEMISTRY", "SCIENCE": "SCIENCE", "WATER": "WATER",
    "TEMPERATURE": "TEMPERATURE", "DEGREE": "DEGREE",
    "GLASS": "GLASS", "PAPER": "PAPER", "WIRE": "WIRE",
    "GOLD": "GOLD", "SILVER": "SILVER", "WEIGHT": "WEIGHT",
    "POWER": "POWER", "STRENGTH": "POWER", "ENERGY": "POWER",
    "ENGINE": "ENGINE", "MOTOR": "ENGINE",
    "NUMBER": "NUMBER", "DIGIT": "NUMBER", "AMOUNT": "NUMBER",
    "RESULT": "RESULT", "OUTCOME": "RESULT", "ANSWER": "ANSWER",
    "EQUAL": "EQUAL", "SAME": "SAME", "IDENTICAL": "SAME",
    
    # Common Verbs (with SIGML files)
    "ADD": "ADD", "PLUS": "ADD", "ADDITION": "ADD",
    "BUILD": "BUILD", "CONSTRUCT": "BUILD", "ASSEMBLE": "BUILD",
    "CLOSE": "CLOSE", "SHUT": "CLOSE",
    "COMPARE": "COMPARE", "CONTRAST": "COMPARE",
    "COPY": "COPY", "DUPLICATE": "COPY", "CLONE": "COPY",
    "COUNT": "COUNT", "TALLY": "COUNT",
    "CUT": "CUT", "SLICE": "CUT", "TRIM": "CUT",
    "FILL": "FILL", "POUR": "FILL",
    "FIND": "FIND", "DISCOVER": "FIND", "LOCATE": "FIND",
    "FLY": "FLY", "SOAR": "FLY",
    "INCREASE": "INCREASE", "RAISE": "INCREASE", "GROW": "INCREASE",
    "JOIN": "JOIN", "CONNECT": "JOIN", "LINK": "JOIN",
    "KEEP": "KEEP", "HOLD": "KEEP", "MAINTAIN": "KEEP",
    "MAKE": "MAKE", "CREATE": "MAKE", "PRODUCE": "MAKE",
    "MARK": "MARK", "LABEL": "MARK",
    "NEED": "NEED", "REQUIRE": "NEED", "MUST": "NEED",
    "OPEN": "OPEN", "UNLOCK": "OPEN",
    "PASS": "PASS", "TRANSFER": "PASS",
    "PUT": "PUT", "PLACE": "PUT", "SET": "PUT",
    "REACH": "REACH", "ARRIVE": "REACH", "ACHIEVE": "REACH",
    "REMOVE": "REMOVE", "DELETE": "REMOVE", "ERASE": "REMOVE",
    "SAVE": "SAVE", "STORE": "SAVE", "PRESERVE": "SAVE",
    "SEARCH": "SEARCH", "LOOK": "SEARCH", "SEEK": "SEARCH",
    "SEND": "SEND", "DELIVER": "SEND", "TRANSMIT": "SEND",
    "SHOW": "SHOW", "DISPLAY": "SHOW", "DEMONSTRATE": "SHOW",
    "TOUCH": "TOUCH", "FEEL": "TOUCH", "CONTACT": "TOUCH",
    "TURN": "TURN", "ROTATE": "TURN", "SPIN": "TURN",
    "WASH": "WASH", "CLEAN": "WASH", "RINSE": "WASH",
    
    # Common Adjectives (with SIGML files)
    "NEW": "NEW", "FRESH": "NEW", "RECENT": "NEW",
    "OLD": "OLD", "ANCIENT": "OLD", "PREVIOUS": "OLD",
    "LONG": "LONG", "LENGTHY": "LONG", "EXTENDED": "LONG",
    "SHORT": "SHORT", "BRIEF": "SHORT",
    "LOUD": "LOUD", "NOISY": "LOUD",
    "QUIET": "QUIET", "SILENT": "QUIET", "CALM": "QUIET",
    "SLOW": "SLOW", "GRADUAL": "SLOW",
    "SOFT": "SOFT", "GENTLE": "SOFT",
    "EMPTY": "EMPTY", "VACANT": "EMPTY", "BLANK": "EMPTY",
    "DIFFERENT": "DIFFERENT", "VARIOUS": "DIFFERENT", "DIVERSE": "DIFFERENT",
    "LEFT": "LEFT",
    "WIDE": "WIDE", "BROAD": "WIDE",
    "TIGHT": "TIGHT", "NARROW": "TIGHT",
    "UNDER": "UNDER", "BELOW": "UNDER", "BENEATH": "UNDER",
    "CIRCLE": "CIRCLE", "ROUND": "CIRCLE", "SPHERE": "CIRCLE",
}

# ============================================================
# MATH/FORMULA PREPROCESSOR (EXPANDED)
# ============================================================

NUM_WORDS = {
    '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR',
    '5': 'FIVE', '6': 'SIX', '7': 'SEVEN', '8': 'EIGHT', '9': 'NINE',
    '10': 'TEN', '11': 'ELEVEN', '12': 'TWELVE', '13': 'THIRTEEN',
    '14': 'FOURTEEN', '15': 'FIFTEEN', '16': 'SIXTEEN', '17': 'SEVENTEEN',
    '18': 'EIGHTEEN', '19': 'NINETEEN', '20': 'TWENTY', '30': 'THIRTY',
    '40': 'FORTY', '50': 'FIFTY', '60': 'SIXTY', '70': 'SEVENTY',
    '80': 'EIGHTY', '90': 'NINETY', '100': 'HUNDRED', '1000': 'THOUSAND',
}

MATH_OPS = {
    '+': 'PLUS', '-': 'MINUS', '*': 'TIMES', '×': 'TIMES',
    '/': 'DIVIDE', '÷': 'DIVIDE', '=': 'EQUAL',
    '>': 'GREATER', '<': 'LESS', '>=': 'GREATER EQUAL',
    '<=': 'LESS EQUAL', '!=': 'NOT EQUAL', '≠': 'NOT EQUAL',
    '≥': 'GREATER EQUAL', '≤': 'LESS EQUAL',
    '^': 'POWER', '√': 'SQUARE ROOT', 'π': 'PI',
    '²': 'SQUARE', '³': 'CUBE',
    '(': 'OPEN PAREN', ')': 'CLOSE PAREN',
    '∫': 'INTEGRAL', '∑': 'SUMMATION', 'Σ': 'SUMMATION',
    'Δ': 'DELTA', '∞': 'INFINITY', '∂': 'PARTIAL',
    '→': 'YIELDS', '⇌': 'REVERSIBLE', '↔': 'EQUILIBRIUM',
}

# Greek letters
GREEK_LETTERS = {
    'α': 'ALPHA', 'β': 'BETA', 'γ': 'GAMMA', 'δ': 'DELTA',
    'ε': 'EPSILON', 'θ': 'THETA', 'λ': 'LAMBDA', 'μ': 'MU',
    'σ': 'SIGMA', 'τ': 'TAU', 'φ': 'PHI', 'ω': 'OMEGA',
    'Ω': 'OMEGA', 'ρ': 'RHO', 'η': 'ETA', 'ν': 'NU',
}

# Expanded chemical formulas (50+)
CHEM_FORMULAS = {
    'h2o': 'H TWO O', 'co2': 'C O TWO', 'o2': 'O TWO',
    'n2': 'N TWO', 'h2': 'H TWO', 'nacl': 'N A C L',
    'h2so4': 'H TWO S O FOUR', 'hcl': 'H C L',
    'naoh': 'N A O H', 'ch4': 'C H FOUR', 'nh3': 'N H THREE',
    'c6h12o6': 'C SIX H TWELVE O SIX', 'fe2o3': 'F E TWO O THREE',
    'caco3': 'C A C O THREE', 'no2': 'N O TWO',
    'so2': 'S O TWO', 'so3': 'S O THREE',
    'hno3': 'H N O THREE', 'h3po4': 'H THREE P O FOUR',
    'ca(oh)2': 'C A OPEN PAREN O H CLOSE PAREN TWO',
    'mgcl2': 'M G C L TWO', 'al2o3': 'A L TWO O THREE',
    'kcl': 'K C L', 'koh': 'K O H',
    'nahco3': 'N A H C O THREE', 'na2co3': 'N A TWO C O THREE',
    'c2h5oh': 'C TWO H FIVE O H', 'ch3cooh': 'C H THREE C O O H',
    'c2h4': 'C TWO H FOUR', 'c2h2': 'C TWO H TWO',
    'c3h8': 'C THREE H EIGHT', 'c4h10': 'C FOUR H TEN',
    'sio2': 'S I O TWO', 'p2o5': 'P TWO O FIVE',
    'mn02': 'M N O TWO', 'zno': 'Z N O',
    'cuso4': 'C U S O FOUR', 'feso4': 'F E S O FOUR',
    'agno3': 'A G N O THREE', 'bacl2': 'B A C L TWO',
    'pbno3': 'P B N O THREE', 'kmno4': 'K M N O FOUR',
    'k2cr2o7': 'K TWO C R TWO O SEVEN',
    'na2so4': 'N A TWO S O FOUR',
    'caso4': 'C A S O FOUR',
    'mg(oh)2': 'M G OPEN PAREN O H CLOSE PAREN TWO',
    'al(oh)3': 'A L OPEN PAREN O H CLOSE PAREN THREE',
    'fe(oh)3': 'F E OPEN PAREN O H CLOSE PAREN THREE',
    'cu(oh)2': 'C U OPEN PAREN O H CLOSE PAREN TWO',
    'nh4cl': 'N H FOUR C L', 'nh4no3': 'N H FOUR N O THREE',
    'co': 'C O', 'no': 'N O', 'n2o': 'N TWO O',
    'cl2': 'C L TWO', 'br2': 'B R TWO', 'i2': 'I TWO',
    'f2': 'F TWO', 'he': 'H E', 'ne': 'N E', 'ar': 'A R',
}

# Physics constants and formulas
PHYSICS_FORMULAS = {
    'f=ma': 'F EQUAL M TIMES A',
    'e=mc2': 'E EQUAL M C SQUARE',
    'e=mc²': 'E EQUAL M C SQUARE',
    'v=ir': 'V EQUAL I R',
    'p=iv': 'P EQUAL I V',
    'pv=nrt': 'P V EQUAL N R T',
    'f=kx': 'F EQUAL K X',
    'v=u+at': 'V EQUAL U PLUS A T',
    's=ut+1/2at2': 'S EQUAL U T PLUS HALF A T SQUARE',
    'v2=u2+2as': 'V SQUARE EQUAL U SQUARE PLUS TWO A S',
    'f=gm1m2/r2': 'F EQUAL G M ONE M TWO DIVIDE R SQUARE',
    'ke=1/2mv2': 'K E EQUAL HALF M V SQUARE',
    'pe=mgh': 'P E EQUAL M G H',
    'w=fd': 'W EQUAL F D',
    'p=w/t': 'P EQUAL W DIVIDE T',
    'λ=v/f': 'LAMBDA EQUAL V DIVIDE F',
}

# Units mapping
UNITS = {
    'm/s': 'METER PER SECOND', 'm/s²': 'METER PER SECOND SQUARE',
    'km/h': 'KILOMETER PER HOUR', 'kg': 'KILOGRAM',
    'mol': 'MOLE', 'hz': 'HERTZ', 'pa': 'PASCAL',
    'j': 'JOULE', 'w': 'WATT', 'n': 'NEWTON',
    'a': 'AMPERE', 'v': 'VOLT', 'ω': 'OHM',
    '°c': 'DEGREE CELSIUS', '°f': 'DEGREE FAHRENHEIT',
    'k': 'KELVIN', 'ev': 'ELECTRON VOLT',
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
        return ' '.join(NUM_WORDS.get(d, d) for d in num_str)
    except ValueError:
        if '.' in num_str:
            parts = num_str.split('.')
            whole = number_to_words(parts[0])
            decimal = ' '.join(NUM_WORDS.get(d, d) for d in parts[1])
            return whole + ' POINT ' + decimal
        return ' '.join(NUM_WORDS.get(d, d) for d in num_str)


def preprocess_math(text):
    """Convert math, formulas, numbers, Greek letters, units to sign-friendly words"""

    # 1. Handle known physics formulas first
    text_lower = text.lower().replace(' ', '')
    for formula, expansion in PHYSICS_FORMULAS.items():
        if formula.replace(' ', '') in text_lower:
            text = re.sub(re.escape(formula), expansion, text, flags=re.IGNORECASE)

    # 2. Handle known chemical formulas
    for formula, expansion in CHEM_FORMULAS.items():
        pattern = re.compile(r'\b' + re.escape(formula) + r'\b', re.IGNORECASE)
        text = pattern.sub(expansion, text)

    # 3. Handle Greek letters
    for greek, word in GREEK_LETTERS.items():
        text = text.replace(greek, f' {word} ')

    # 4. Handle subscripts (x₁ -> X ONE)
    subscripts = {'₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
                  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'}
    for sub, digit in subscripts.items():
        text = text.replace(sub, digit)

    # 5. Handle coefficients like 2ab -> TWO A B
    def expand_coefficients(match):
        num = match.group(1)
        vars_str = match.group(2)
        expanded_vars = ' '.join(list(vars_str.upper()))
        return f" {number_to_words(num)} {expanded_vars} "

    text = re.sub(r'(\d+)([a-zA-Z]+)', expand_coefficients, text)

    # 6. Handle exponents
    def expand_exponents(match):
        base = match.group(1)
        exp = match.group(2)
        if base.isalpha():
            base = base.upper()
        word = ""
        if exp == '2':
            word = "SQUARE"
        elif exp == '3':
            word = "CUBE"
        else:
            word = f"POWER {number_to_words(exp)}"
        return f" {base} {word} "

    text = re.sub(r'([a-zA-Z]|\))(\d+)', expand_exponents, text)

    # 7. Uppercase single letters (variables)
    text = re.sub(r'\b[a-z]\b', lambda m: m.group(0).upper(), text)

    # 8. Replace symbols/operators
    for op, word in sorted(MATH_OPS.items(), key=lambda x: -len(x[0])):
        text = text.replace(op, f' {word} ')

    # 9. Convert remaining numbers
    def replace_remaining_numbers(match):
        return ' ' + number_to_words(match.group(0)) + ' '

    text = re.sub(r'\b\d+\.?\d*\b', replace_remaining_numbers, text)

    # Clean up
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ============================================================
# LLM-BASED SIGN LANGUAGE GLOSS CONVERSION (GROQ)
# ============================================================

def build_gloss_prompt(text, language="isl"):
    """Build prompt for Groq/Llama to convert STEM English to sign gloss.
    ISL uses SOV (Subject-Object-Verb) grammar — verb always LAST.
    ASL uses SVO (Subject-Verb-Object) grammar — similar to English.
    """
    if language == "asl":
        # ASL: Keep EXACT English word order, just drop filler words
        prompt = f"""Task: Convert English sentence to ASL (American Sign Language) Gloss.

STRICT Rules:
1. Keep the EXACT same word order as the original English sentence.
2. Convert all words to UPPERCASE.
3. Remove ONLY articles and be-verbs: THE, A, AN, IS, AM, ARE, WAS, WERE, BE, BEEN.
4. DO NOT rearrange any words.
5. If it's a question, keep the word order as is.

Examples:
"She asked an important question" -> SHE ASKED IMPORTANT QUESTION
"I eat food every day" -> I EAT FOOD EVERY DAY
"The boy kicked the ball" -> BOY KICKED BALL
"I don't understand the formula" -> I DON'T UNDERSTAND FORMULA

Math/STEM:
- (+) PLUS, (-) MINUS, (=) EQUAL, (*) TIMES, (/) DIVIDE
- H2O -> H TWO O, CO2 -> C O TWO

Text: {text}
ASL Gloss:"""
    else:
        # ISL: SOV order (verb ALWAYS comes last)
        prompt = f"""Task: Convert English sentence to ISL (Indian Sign Language) Gloss.

CRITICAL ISL Grammar Rules:
1. Word order MUST be: [Subject] [Time/Location] [Object] [Verb].
2. The Subject must come FIRST.
3. The main Verb must ALWAYS come LAST.
4. Remove articles: THE, A, AN, IS, AM, ARE, WAS, WERE, BE, BEEN.
5. Negation: Put "NOT" after the verb at the very end.

Correct Pattern:
- English: "I eat food every day" -> ISL: "I FOOD EVERY DAY EAT"
- English: "She asked a question" -> ISL: "GIRL QUESTION ASK"
- English: "The boy kicked the ball" -> ISL: "BOY BALL KICK"
- English: "I don't understand" -> ISL: "I UNDERSTAND NOT"

Text: {text}
ISL Gloss:"""
    return prompt


# System prompts for each language
SYSTEM_PROMPTS = {
    "isl": "You are an ISL (Indian Sign Language) expert. You MUST use SOV (Subject-Object-Verb) grammar. The verb ALWAYS comes last. Output ONLY UPPERCASE gloss words. No explanations.",
    "asl": "You are an ASL (American Sign Language) expert. You MUST keep the EXACT English word order. DO NOT REARRANGE. Output ONLY UPPERCASE gloss words. No explanations.",
}


def llm_to_gloss(text, language="isl"):
    """Use Groq/Llama 3.3 to convert English/STEM text to sign language gloss"""
    try:
        prompt = build_gloss_prompt(text, language)
        system_prompt = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["isl"])

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0,  # Strict determinism
            max_tokens=300,
        )

        raw = response.choices[0].message.content.strip()
        print(f"[LLM] Raw response ({language}): {raw}")

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
        for prefix in ["ASL:", "ISL:", "GLOSS:", "Gloss:", "Output:", "Answer:", "ISL GLOSS:", "ASL GLOSS:"]:
            if first_line.upper().startswith(prefix.upper()):
                first_line = first_line[len(prefix):].strip()

        final_gloss_text = first_line
        print(f"[GLOSS] '{final_gloss_text}'")

        # Remove non-alpha/non-space/non-digit (to keep numbers like H2O)
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', final_gloss_text)
        gloss_words = [w.upper() for w in cleaned.split() if w.strip()]

        if gloss_words:
            print(f"[LLM] Parsed ({language}) gloss: {gloss_words}")
            return gloss_words

    except Exception as e:
        print(f"[LLM ERROR] {e}")

    # Fallback: Simple word order mapping
    print(f"[FALLBACK] Simple mapping for {language}")
    processed_input = preprocess_math(text)
    stop = {'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
            'do', 'does', 'did', 'will', 'would', 'can', 'could', 'shall', 'should',
            'may', 'might', 'must', 'have', 'has', 'had', 'to', 'of', 'for', 'it'}
    words = processed_input.split()
    result = [w.upper() for w in words if w.strip() and w.lower() not in stop]
    return result if result else [w.upper() for w in text.split() if w.isalpha()]


# ============================================================
# TOPIC-WISE STEM STRUCTURING
# ============================================================

def structure_stem_content(text):
    """Use Groq to split STEM text into Definition, Formula, Example sections"""
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": """You are a STEM content structurer. Given educational text, split it into exactly 3 sections. 
Return ONLY valid JSON with this format:
{"definition": "simple explanation of the concept", "formula": "the mathematical formula or equation if any, otherwise empty string", "example": "a practical example or application"}
Keep each section short (1-2 sentences max). If there's no formula, put empty string. Always return valid JSON."""},
                {"role": "user", "content": f"Structure this STEM content:\n\n{text}"}
            ],
            temperature=0.1,
            max_tokens=400,
        )

        raw = response.choices[0].message.content.strip()
        print(f"[STRUCTURE] Raw: {raw}")

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "definition": result.get("definition", ""),
                "formula": result.get("formula", ""),
                "example": result.get("example", "")
            }
    except Exception as e:
        print(f"[STRUCTURE ERROR] {e}")

    return {"definition": text, "formula": "", "example": ""}


# ============================================================
# SIGML FILE MATCHING
# ============================================================

def match_to_sigml(gloss_words):
    """Enhanced matching with recursive suffix stripping and synonym checking.
    Every word added is verified to have a valid SIGML file on disk.
    If not, it falls back to fingerspelling."""
    result = []
    suffixes = ["ING", "ED", "LY", "ES", "S"]
    sigml_dir = os.path.join("static", "SignFiles")
    
    def sigml_exists(word_lower):
        """Check if SIGML file actually exists on disk"""
        return os.path.exists(os.path.join(sigml_dir, f"{word_lower}.sigml"))
    
    def find_in_vocab(w):
        """Check word and its synonyms, but ONLY if the SIGML file exists"""
        w_lower = w.lower()
        if w_lower in VALID_WORDS and sigml_exists(w_lower):
            return w_lower
        syn = SYNONYM_MAP.get(w.upper())
        if syn and syn.lower() in VALID_WORDS and sigml_exists(syn.lower()):
            return syn.lower()
        return None

    for word in gloss_words:
        word_upper = word.upper()
        found = False
        
        # 1. Direct or Synonym check
        match = find_in_vocab(word_upper)
        if match:
            result.append(match)
            continue
            
        # 2. Suffix stripping loop
        temp_word = word_upper
        for suffix in suffixes:
            if temp_word.endswith(suffix) and len(temp_word) > len(suffix):
                root = temp_word[:-len(suffix)]
                match = find_in_vocab(root)
                if match:
                    result.append(match)
                    found = True
                    break
        
        if found:
            continue

        # 3. Fingerspell — verify each letter file exists too
        for letter in word.lower():
            if letter.isalpha():
                if sigml_exists(letter):
                    result.append(letter)
                else:
                    print(f"[WARN] No SIGML for letter '{letter}', skipping")
    return result


# ============================================================
# HISTORY MANAGEMENT
# ============================================================

def load_history():
    """Load translation history from file"""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_to_history(entry):
    """Save a translation to history"""
    history = load_history()
    history.insert(0, entry)
    # Keep only last 50 entries
    history = history[:50]
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)


# ============================================================
# FLASK ROUTES
# ============================================================

final_words_dict = {}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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

    # Step 0: Check if input is a known chemical formula (bypass LLM)
    text_clean = text.strip()
    text_key = text_clean.lower().replace(' ', '')
    if text_key in CHEM_FORMULAS:
        expansion = CHEM_FORMULAS[text_key]
        gloss_words = [w.upper() for w in expansion.split() if w.strip()]
        print(f"[CHEM BYPASS] '{text_clean}' -> {gloss_words}")
    else:
        # Step 1: LLM converts English → Sign Language Gloss
        gloss_words = llm_to_gloss(text_clean, language)

    # Step 2: Match gloss words to SIGML files
    sigml_sequence = match_to_sigml(gloss_words)

    print(f"[SIGML] Sequence: {sigml_sequence}")

    # Build response dict
    for i, word in enumerate(sigml_sequence, start=1):
        final_words_dict[str(i)] = word

    # NOTE: Do NOT uppercase single-letter words.
    # SIGML files are stored lowercase (a.sigml, c.sigml, etc.)
    # Uppercasing causes 404 errors on the browser side.

    # Add display text
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

    # Save to history
    save_to_history({
        "input": text,
        "language": language,
        "gloss": ' '.join(gloss_words),
        "display": final_words_dict['_display'],
        "timestamp": datetime.datetime.now().isoformat()
    })

    return jsonify(final_words_dict)


@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and extract text"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported format. Supported: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    print(f"[UPLOAD] Saved file: {filename}")

    # Extract text
    extracted = extract_text(filepath)

    # Cleanup temp file
    try:
        os.remove(filepath)
    except Exception:
        pass

    if not extracted:
        return jsonify({"error": "Could not extract text from the file"}), 400

    return jsonify({
        "text": extracted,
        "filename": filename,
        "characters": len(extracted)
    })


@app.route('/structure', methods=['POST'])
def structure_content():
    """Structure STEM content into Definition/Formula/Example"""
    data = request.get_json()
    text = data.get('text', '')

    if not text.strip():
        return jsonify({"error": "No text provided"}), 400

    result = structure_stem_content(text)
    return jsonify(result)


@app.route('/ask', methods=['POST'])
def ask_doubt():
    """Doubt Clarification: Answer a question and translate to sign language"""
    global final_words_dict
    final_words_dict = {}

    data = request.get_json()
    question = data.get('question', '').strip()
    language = data.get('language', 'isl')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    print(f"\n{'='*50}")
    print(f"[DOUBT] Question: {question} | Language: {language}")
    print(f"{'='*50}")

    try:
        # Step 1: Get a simple answer using Groq
        answer_response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful STEM tutor. Give very short, simple answers in 1-2 sentences maximum. Use easy words. No jargon. Explain like you're talking to a 10 year old."},
                {"role": "user", "content": question}
            ],
            temperature=0.3,
            max_tokens=150,
        )
        answer_text = answer_response.choices[0].message.content.strip()
        print(f"[DOUBT] Answer: {answer_text}")

        # Step 2: Convert the answer to sign language gloss
        gloss_words = llm_to_gloss(answer_text, language)

        # Step 3: Match gloss to SIGML
        sigml_sequence = match_to_sigml(gloss_words)

        # Build response dict for avatar playback
        for i, word in enumerate(sigml_sequence, start=1):
            final_words_dict[str(i)] = word

        # Add display text
        display_parts = []
        for word in gloss_words:
            word_lower = word.lower()
            if word_lower in VALID_WORDS:
                display_parts.append(word.upper())
            else:
                display_parts.append('-'.join(word.upper()))
        final_words_dict['_display'] = ' '.join(display_parts)

        print(f"[DOUBT] Gloss: {final_words_dict['_display']}")

        # Save to history
        save_to_history({
            "input": f"[DOUBT] {question}",
            "language": language,
            "answer": answer_text,
            "gloss": ' '.join(gloss_words),
            "display": final_words_dict['_display'],
            "timestamp": datetime.datetime.now().isoformat()
        })

        return jsonify({
            "answer": answer_text,
            "translation": final_words_dict
        })

    except Exception as e:
        print(f"[DOUBT ERROR] {e}")
        return jsonify({"error": f"Failed to process question: {str(e)}"}), 500


@app.route('/structure', methods=['POST'])
def structure_topic_content():
    """Topic-Wise Mode: Use AI to split text into Definition, Formula, and Example"""
    data = request.get_json()
    text = data.get('text', '').strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    print(f"[TOPIC] Structuring content: {text[:50]}...")

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": """You are a STEM content organizer. 
                Split the given text into three distinct sections:
                1. definition: A clear, simple definition of the core concept.
                2. formula: Any mathematical formulas or chemical equations found.
                3. example: A real-world example or application.
                
                Return ONLY a JSON object with keys: "definition", "formula", "example".
                If a section is missing, provide a short 1-sentence summary based on the text.
                No markdown, no preamble."""},
                {"role": "user", "content": text}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        structured = json.loads(response.choices[0].message.content)
        return jsonify(structured)

    except Exception as e:
        print(f"[TOPIC ERROR] {e}")
        return jsonify({
            "definition": text,
            "formula": "Not detected",
            "example": "Not detected"
        })


@app.route('/export', methods=['POST'])
def export_lesson():
    """Export the current translation as a lesson package"""
    data = request.get_json()

    lesson = {
        "title": data.get('title', 'Untitled Lesson'),
        "input_text": data.get('input_text', ''),
        "language": data.get('language', 'isl'),
        "gloss_display": data.get('gloss_display', ''),
        "structured": data.get('structured', None),
        "sigml_sequence": data.get('sigml_sequence', []),
        "created_at": datetime.datetime.now().isoformat(),
        "version": "1.0"
    }

    return jsonify(lesson)


@app.route('/history', methods=['GET'])
def get_history():
    """Get translation history"""
    history = load_history()
    return jsonify(history)


@app.route('/static/<path:path>')
def serve_signfiles(path):
    return send_from_directory('static', path)


@app.route('/jas-proxy/<path:path>')
def jas_proxy(path):
    """Proxy requests to UEA JASigning server to bypass CORS"""
    jas_base = 'http://vhg.cmp.uea.ac.uk/tech/jas/vhg2017/'
    url = jas_base + path
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'SignBridge/1.0')
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            content_type = resp.headers.get('Content-Type', 'application/octet-stream')
            from flask import Response
            return Response(data, content_type=content_type)
    except Exception as e:
        print(f'[JAS-PROXY ERROR] {url}: {e}')
        return jsonify({'error': str(e)}), 502


if __name__ == "__main__":
    print(f"[SERVER] Starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', debug=True)
