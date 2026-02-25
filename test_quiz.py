"""Comprehensive test for the Sign Learning Challenge"""
import urllib.request
import json
import os

BASE = "http://127.0.0.1:5000"
H = {"Content-Type": "application/json"}
errors = []
tests_passed = 0

def api(path, data=None):
    if data:
        req = urllib.request.Request(BASE + path, data=json.dumps(data).encode(), headers=H)
    else:
        req = urllib.request.Request(BASE + path)
    return json.loads(urllib.request.urlopen(req).read())

# TEST 1: Categories
print("=== TEST 1: Categories ===")
cats = api("/learn/categories")
print(f"  {len(cats)} categories returned")
assert len(cats) == 7, f"Expected 7 categories, got {len(cats)}"
for c in cats:
    print(f"    {c['name']}: {c['count']} words")
tests_passed += 1

# TEST 2: Words for each category
print("\n=== TEST 2: Words for each category ===")
for cat in cats:
    words = api("/learn/words", {"category": cat["name"]})
    assert len(words) == cat["count"], f"{cat['name']}: expected {cat['count']}, got {len(words)}"
    assert all("word" in w and "sigml" in w for w in words), f"{cat['name']}: missing fields"
    
    # Check SIGML files exist
    for w in words:
        sigml_path = os.path.join("static", "SignFiles", f"{w['word']}.sigml")
        if not os.path.exists(sigml_path):
            errors.append(f"MISSING SIGML: {w['word']}.sigml")
    
    print(f"  {cat['name']}: {len(words)} words OK, all have sigml field")
    tests_passed += 1

# TEST 3: Quiz for each category
print("\n=== TEST 3: Quiz for each category ===")
for cat in cats:
    quiz = api("/learn/quiz", {"category": cat["name"]})
    assert "question_word" in quiz, f"{cat['name']}: missing question_word"
    assert "options" in quiz, f"{cat['name']}: missing options"
    assert "correct_index" in quiz, f"{cat['name']}: missing correct_index"
    assert "sigml" in quiz, f"{cat['name']}: missing sigml"
    assert len(quiz["options"]) == 4, f"{cat['name']}: expected 4 options, got {len(quiz['options'])}"
    assert quiz["options"][quiz["correct_index"]] == quiz["question_word"], \
        f"{cat['name']}: correct_index doesn't match question_word"
    
    print(f"  {cat['name']}: Q='{quiz['question_word']}', options={quiz['options']}, correct_idx={quiz['correct_index']} OK")
    tests_passed += 1

# TEST 4: Quiz diversity (5 rounds of Family)
print("\n=== TEST 4: Quiz diversity (5 rounds) ===")
seen = set()
for i in range(5):
    quiz = api("/learn/quiz", {"category": cats[2]["name"]})
    seen.add(quiz["question_word"])
    assert quiz["question_word"] in quiz["options"], f"Round {i+1}: answer not in options!"
print(f"  5 rounds, {len(seen)} unique questions: {seen}")
assert len(seen) >= 2, "Quiz should generate diverse questions"
tests_passed += 1

# TEST 5: Error handling
print("\n=== TEST 5: Error handling ===")
try:
    api("/learn/words", {"category": "FakeCategory"})
    errors.append("Expected 404 for invalid category")
except urllib.error.HTTPError as e:
    assert e.code == 404, f"Expected 404, got {e.code}"
    print(f"  Invalid category returns 404: OK")
    tests_passed += 1

# RESULTS
print("\n" + "=" * 50)
print(f"Tests passed: {tests_passed}")
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  - {e}")
else:
    print("ALL TESTS PASSED! ✅")
