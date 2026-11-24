import os
from google import genai


def generate_answer(question: str, context: str = "") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing from your .env file")

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    client = genai.Client(api_key=api_key)

    prompt = f"""You are EduMentor-AI, a professional academic assistant for a university learning platform.

Help with:
- Thesis writing & research methodology
- Academic questions & guidance
- Assignment planning & deadlines
- Course material explanations
- Study tips and academic advice

Use clear, professional language. Never invent facts.
If context is insufficient, clearly say so.

USER WORKSPACE CONTEXT:
{context if context else "No saved context available."}

USER QUESTION:
{question}
"""

    try:
        interaction = client.models.generate_content(
            model=model,
            contents=prompt
        )
        answer = getattr(interaction, "text", None)
        if not answer:
            candidates = getattr(interaction, "candidates", [])
            if candidates:
                parts = getattr(candidates[0].content, "parts", [])
                answer = "".join(getattr(p, "text", "") for p in parts)
        if not answer:
            raise RuntimeError("Gemini returned an empty answer")
        return answer.strip()
    finally:
        pass
