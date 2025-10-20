import os
import sys
import json
import subprocess
from transformers import pipeline
import torch
from sentence_transformers import SentenceTransformer, util
import google.generativeai as genai  # <-- Keep this
from dotenv import load_dotenv

# ---- LOAD ENV VARIABLES ----
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# ---- CHECK COMMAND-LINE ARGUMENTS ----
if len(sys.argv) < 3:
    print(json.dumps({"error": "Usage: python script.py <video_path> <ideal_answer>"}))
    sys.exit(1)

video_path = sys.argv[1]    # Video file path
ideal_answer = sys.argv[2]  # Ideal answer for similarity comparison

# ---- CONFIG ----
os.environ["IMAGEIO_FFMPEG_EXE"] = r"C:\Users\yasmi\Downloads\ffmpeg-8.0\ffmpeg-8.0-essentials_build\bin\ffmpeg.exe"

# ---- HELPER FUNCTION ----
def polish_transcript_with_gemini(raw_text, question_text):
    prompt = f"""
You are helping to clean and understand an interview answer.
The interviewee was asked this question: "{question_text}"

Their answer was transcribed as: "{raw_text}"

Your task:
- Correct any grammar or spelling mistakes
- Organize sentences clearly
- Keep the meaning exactly as intended
- If a word seems misheard or unclear, guess what the interviewee meant using context from the question
- Do NOT add unrelated information

Provide only the polished answer.
"""
    model = genai.GenerativeModel('models/gemini-pro-latest')
    response = model.generate_content(prompt)
    return response.text.strip()

# ---- MAIN PROCESS ----
try:
    # Step 1: Prepare the Hugging Face Whisper pipeline (open-source)
    print("Loading open-source Whisper model from Hugging Face (this may download once)...")
    # choose device: 0 for GPU, -1 for CPU
    device = 0 if torch.cuda.is_available() else -1

    whisper_pipeline = pipeline(
        "automatic-speech-recognition",
        model="distil-whisper/medium.en",   # open-source, HF-hosted
        device=device
    )
    print("Whisper model (Hugging Face) loaded.")

    # Step 2: Convert video to mono 16kHz WAV
    audio_file = "temp_audio.wav"
    print("Extracting audio from video...")
    subprocess.run([
        os.environ["IMAGEIO_FFMPEG_EXE"],
        "-i", video_path,
        "-ac", "1",
        "-ar", "16000",
        audio_file,
        "-y"
    ], check=True)
    print("Audio extracted.")

    # Step 3: Transcribe audio using HF pipeline
    print("Transcribing audio...")
    # The pipeline accepts a path to the file
    result = whisper_pipeline(audio_file)
    # result may be a dict like {"text": "..."}
    raw_transcript = result.get("text") if isinstance(result, dict) else str(result)
    print("Transcription complete.")
    # Optionally delete temp audio when done:
    # os.remove(audio_file)

    # Step 4: Polish transcript using Gemini API
    print("Polishing transcript with Gemini API...")
    polished_transcript = polish_transcript_with_gemini(raw_transcript, ideal_answer)
    print("Transcript polished.")

    # Step 5: Compute semantic similarity
    print("Computing similarity...")
    sim_model = SentenceTransformer("all-MiniLM-L6-v2")
    emb1 = sim_model.encode(ideal_answer, convert_to_tensor=True)
    emb2 = sim_model.encode(polished_transcript, convert_to_tensor=True)
    similarity = util.pytorch_cos_sim(emb1, emb2).item()
    print("Similarity computed.")

    # Step 6: Return JSON
    print(json.dumps({
        "raw_transcript": raw_transcript,
        "polished_transcript": polished_transcript,
        "similarity": round(similarity, 2)
    }))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
