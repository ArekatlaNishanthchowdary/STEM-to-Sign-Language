"""Discover STEM words with SIGML files that are not yet in SYNONYM_MAP."""
import os

sigml_dir = 'static/SignFiles'
available = {f[:-6].lower() for f in os.listdir(sigml_dir) if f.endswith('.sigml') and len(f[:-6]) > 1}

# Read current synonym map values from main.py
with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Get all words already referenced in SYNONYM_MAP (both keys and values)
import re
match = re.search(r'SYNONYM_MAP\s*=\s*\{(.*?)\}', content, re.DOTALL)
used_words = set()
if match:
    pairs = re.findall(r'"([^"]+)":\s*"([^"]+)"', match.group(1))
    for k, v in pairs:
        used_words.add(k.lower())
        used_words.add(v.lower())

# STEM-relevant keywords to search for
stem_keywords = [
    'acid', 'atom', 'base', 'battery', 'brain', 'carbon', 'cell', 'charge',
    'chemistry', 'circle', 'computer', 'current', 'data', 'degree', 'diamond',
    'earth', 'electric', 'electron', 'element', 'energy', 'engine', 'experiment',
    'fire', 'force', 'gas', 'glass', 'gold', 'gravity', 'heat', 'hydrogen',
    'iron', 'lamp', 'laser', 'light', 'liquid', 'machine', 'magnet', 'mass',
    'math', 'measure', 'metal', 'mirror', 'moon', 'muscle', 'nature', 'nitrogen',
    'nuclear', 'number', 'ocean', 'oil', 'oxygen', 'paper', 'particle', 'physics',
    'planet', 'plant', 'plastic', 'poison', 'pollution', 'power', 'pressure',
    'protein', 'proton', 'radiation', 'radio', 'rain', 'reaction', 'result',
    'robot', 'rock', 'rubber', 'salt', 'satellite', 'science', 'silver', 'solar',
    'solid', 'solution', 'sound', 'space', 'speed', 'star', 'steam', 'steel',
    'stone', 'sugar', 'sun', 'surface', 'temperature', 'test', 'thunder', 'tool',
    'universe', 'vacuum', 'virus', 'volcano', 'volume', 'water', 'wave', 'weather',
    'weight', 'wind', 'wire', 'wood', 'zinc',
    # Additional common verbs/adjectives
    'add', 'answer', 'build', 'calculate', 'change', 'clean', 'close', 'cold',
    'compare', 'connect', 'copy', 'count', 'create', 'cut', 'dark', 'deep',
    'destroy', 'different', 'dirty', 'discover', 'dry', 'empty', 'equal',
    'fast', 'fill', 'find', 'flat', 'float', 'flow', 'fly', 'freeze',
    'grow', 'half', 'heavy', 'help', 'hide', 'high', 'hot', 'increase',
    'inside', 'join', 'keep', 'kill', 'large', 'left', 'lift', 'long',
    'look', 'loud', 'low', 'make', 'mark', 'match', 'melt', 'mix',
    'move', 'narrow', 'need', 'new', 'old', 'open', 'opposite', 'outside',
    'part', 'pass', 'point', 'pull', 'push', 'put', 'quick', 'quiet',
    'reach', 'remove', 'replace', 'right', 'round', 'safe', 'same',
    'save', 'search', 'send', 'separate', 'sharp', 'short', 'show',
    'shut', 'side', 'slow', 'smooth', 'soft', 'sort', 'split', 'spread',
    'square', 'straight', 'strong', 'thick', 'thin', 'tight', 'top',
    'total', 'touch', 'turn', 'under', 'use', 'warm', 'wash', 'weak',
    'wet', 'whole', 'wide',
]

found = []
for w in stem_keywords:
    if w in available and w not in used_words:
        found.append(w)

print(f'Found {len(found)} STEM words with SIGML files but NOT in SYNONYM_MAP:')
for w in sorted(found):
    print(f'  "{w.upper()}": "{w.upper()}",')
