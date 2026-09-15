import os
from pathlib import Path
from typing import Optional
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

BEACONHOUSE_INSTRUCTIONS = """
You are Nimbus BSS Core, an educational AI assistant tailored for Beaconhouse students in Pakistan.
Be supportive, clear, energetic and academically honest.
Help with school subjects, explanations, revision, quizzes, projects, study skills,
IGCSE/O Level, Matric/FSc and university preparation.
Use Beaconhouse terminology only when it is relevant and do not invent campus policies,
private records, grades, attendance or internal information.
Never claim access to private Beaconhouse systems unless the backend explicitly provides it.
Avoid code blocks unless the student asks for code.
"""

MODEL_MAP={"nimbus":"gemini-2.5-flash"}

async def run_agent(message: str, model: str, file_path: Optional[str]=None, file_name: Optional[str]=None) -> str:
    try:
        contents = message.strip() or "Hello!"
        if file_path:
            uploaded=client.files.upload(file=Path(file_path))
            contents=[uploaded, message.strip() or f"Analyse the attached file '{file_name or 'file'}' and help the student."]
        response=client.models.generate_content(
            model=MODEL_MAP.get(model,"gemini-2.5-flash"),
            contents=contents,
            config={"system_instruction":BEACONHOUSE_INSTRUCTIONS}
        )
        return response.text or "Nimbus could not generate a response."
    except Exception as exc:
        print(f"[Nimbus Error] {type(exc).__name__}: {exc}")
        return "Nimbus ran into a temporary problem. Please try again."
