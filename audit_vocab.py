import os
import re

def audit():
    sigml_dir = 'static/SignFiles'
    available_files = {f[:-6].lower() for f in os.listdir(sigml_dir) if f.endswith('.sigml')}
    
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract SYNONYM_MAP
    match = re.search(r'SYNONYM_MAP = \{(.*?)\}', content, re.DOTALL)
    if not match:
        print("Could not find SYNONYM_MAP")
        return
    
    map_content = match.group(1)
    # Simple parser for "KEY": "VALUE"
    mappings = re.findall(r'\"(.*?)\":\s*\"(.*?)\"', map_content)
    
    print(f"--- Auditing SYNONYM_MAP ({len(mappings)} entries) ---")
    errors = 0
    for key, val in mappings:
        val_lower = val.lower()
        if val_lower not in available_files:
            print(f"ERROR: Mapping '{key}' -> '{val}' is invalid. '{val_lower}.sigml' NOT FOUND.")
            errors += 1
            
    # Also check CHEM_FORMULAS expansions (they contain multiple words)
    chem_match = re.search(r'CHEM_FORMULAS = \{(.*?)\}', content, re.DOTALL)
    if chem_match:
        chem_content = chem_match.group(1)
        chem_entries = re.findall(r'\"(.*?)\":\s*\"(.*?)\"', chem_content)
        print(f"\n--- Auditing CHEM_FORMULAS expansions ---")
        for formula, expansion in chem_entries:
            words = expansion.split()
            for word in words:
                if word.lower() not in available_files:
                    print(f"ERROR: Formula '{formula}' uses '{word}', but '{word.lower()}.sigml' NOT FOUND.")
                    errors += 1

    print(f"\nAudit complete. Total errors found: {errors}")

if __name__ == "__main__":
    audit()
