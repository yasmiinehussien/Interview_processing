import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

print("--- Finding available models ---")

# List all models and check which ones can be used for generating text
for m in genai.list_models():
  if 'generateContent' in m.supported_generation_methods:
    print(m.name)

print("---------------------------------")