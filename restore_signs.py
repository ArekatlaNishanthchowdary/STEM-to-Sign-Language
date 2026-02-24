import urllib.request
import os
import time

BASE_URL = "https://raw.githubusercontent.com/ArekatlaNishanthchowdary/STEM-to-Sign-Language/main/static/SignFiles/"
TARGET_DIR = "static/SignFiles"

# Critical files lost during normalization
MISSING_FILES = [
    # Alphabet
    "a.sigml", "b.sigml", "c.sigml", "d.sigml", "e.sigml", "f.sigml", "g.sigml", "h.sigml", "i.sigml", 
    "j.sigml", "k.sigml", "l.sigml", "m.sigml", "n.sigml", "o.sigml", "p.sigml", "q.sigml", "r.sigml", 
    "s.sigml", "t.sigml", "u.sigml", "v.sigml", "w.sigml", "x.sigml", "y.sigml", "z.sigml",
    # Numbers
    "eleven.sigml", "twelve.sigml", "thirteen.sigml", "fourteen.sigml", "fifteen.sigml", 
    "sixteen.sigml", "seventeen.sigml", "eighteen.sigml", "nineteen.sigml"
]

def restore():
    print(f"Starting restoration of {len(MISSING_FILES)} critical signs...")
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        
    for filename in MISSING_FILES:
        target_path = os.path.join(TARGET_DIR, filename.lower())
        
        # Try both cases for the URL
        variants = [filename.lower(), filename.upper(), filename.capitalize()]
        if len(filename) == 1: # Alphabet files often A.sigml
            variants = [filename.upper(), filename.lower()]
            
        success = False
        for v in variants:
            url = BASE_URL + (v if v.endswith(".sigml") else v + ".sigml")
            try:
                print(f"Trying {url}...")
                urllib.request.urlretrieve(url, target_path)
                if os.path.getsize(target_path) > 200: # Valid SIGML is usually > 200 bytes
                    success = True
                    break
            except:
                continue
                
        if success:
            print(f"  Successfully restored {filename}")
        else:
            print(f"  FAILED to restore {filename} after several variants.")
        
        time.sleep(0.3)

    print("\nRestoration complete. Checking for missing files...")
    all_files = [f.lower() for f in os.listdir(TARGET_DIR)]
    still_missing = [f for f in MISSING_FILES if f.lower() not in all_files]
    
    if still_missing:
        print(f"STILL MISSING: {still_missing}")
    else:
        print("All critical files restored successfully!")

if __name__ == "__main__":
    restore()
