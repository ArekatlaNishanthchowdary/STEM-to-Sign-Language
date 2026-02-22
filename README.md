# Text to Sign Language Translator (ISL & ASL)

A modern, STEM-optimized Sign Language translator that converts English text and mathematical/chemical notations into Indian Sign Language (ISL) or American Sign Language (ASL) animations.

## Key Features
- **Dual Language Support**: Integrated ASL (American) and ISL (Indian) grammar engines.
- **STEM Optimized**: Handles complex algebraic identities and chemical formulas (e.g., `(a+b)2 = a2+2ab+b2`, `H2O`).
- **Local AI Translation**: Powered by **Ollama (Llama 3.2)** for reliable, offline, and private translations.
- **GPU Accelerated**: Uses **PyTorch/Stanza** with CUDA acceleration (RTX 4060 supported) for fast linguistic parsing.
- **Modern UI**: Dark-themed, responsive dashboard with a signing avatar.

## Prerequisites
1. **Python 3.10+**
2. **Ollama**: [Download and install](https://ollama.com/)
   - Pull the model: `ollama pull llama3.2`
3. **NVIDIA GPU** (Optional but recommended for RTX 40 series users):
   - Supports CUDA-enabled parsing via PyTorch.

## Installation

1. Clone the repository:
   ```sh
   git clone <your-repo-url>
   cd text_to_isl-main
   ```

2. Setup virtual environment:
   ```sh
   python -m venv venv
   .\venv\Scripts\Activate.ps1  # Windows
   source venv/bin/activate      # Linux/macOS
   ```

3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the Flask server:
   ```sh
   python main.py
   ```

2. Open your browser and navigate to:
   `http://127.0.0.1:5000`

## Tech Stack
- **Backend**: Flask (Python)
- **AI/NLP**: Ollama (Llama 3.2), Stanza (Stanford NLP), NLTK
- **Frontend**: Vanilla JS, Modern CSS (Glassmorphism)
- **Animation**: SIGML (Signing Gesture Markup Language)

## Credits
- SIGML Player: [CWA Signing Avatars](https://vh.cmp.uea.ac.uk/index.php/CWA_Signing_Avatars)
- Original Base: Diverse open-source SIGML projects and research papers.

---
*Optimized for HackX 2026*
