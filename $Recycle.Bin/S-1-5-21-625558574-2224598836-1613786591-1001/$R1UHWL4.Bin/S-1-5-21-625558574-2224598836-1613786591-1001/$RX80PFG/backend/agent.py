import os
from pathlib import Path
from typing import Optional

from google import genai


client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)


BEACONHOUSE_INSTRUCTIONS = """
You are Nimbus, an AI assistant tailored for the Beaconhouse School System
network across Pakistan.

Be supportive, energetic, educational, and helpful.

Help students with:
- school subjects
- revision and exam preparation
- assignments and projects
- study skills
- IGCSE / O Level preparation
- Matric / FSc pathways
- university preparation
- general educational questions

When relevant, you may refer to Beaconhouse student life, leadership,
activities, competitions, and educational culture.

Never claim access to private Beaconhouse student records, grades,
attendance, passwords, or internal systems unless an authorized backend
actually provides that information.

Do not invent school-specific policies or facts.

For important school-specific information, recommend checking an official
Beaconhouse source or asking a teacher.

Do not output code blocks unless the student specifically asks for code.

Your identity is Nimbus BSS Core.
"""


MODEL_MAP = {
    "nimbus": "gemini-2.5-flash",
    "study": "gemini-2.5-flash",
    "code": "gemini-2.5-flash",
}


async def run_agent(
    message: str,
    model: str,
    file_path: Optional[str] = None,
    file_name: Optional[str] = None,
) -> str:

    try:
        gemini_model = MODEL_MAP.get(
            model,
            "gemini-2.5-flash"
        )

        if file_path:
            uploaded_file = client.files.upload(
                file=Path(file_path)
            )

            contents = [
                uploaded_file,
                message.strip()
                or f"Please analyse the attached file '{file_name or 'file'}' and help the student."
            ]

        else:
            contents = message.strip() or "Hello!"

        response = client.models.generate_content(
            model=gemini_model,
            contents=contents,
            config={
                "system_instruction": BEACONHOUSE_INSTRUCTIONS
            }
        )

        return response.text or "Nimbus could not generate a response."

    except Exception as exc:
        print(f"[Nimbus Error] {type(exc).__name__}: {exc}")
        return "Nimbus ran into a temporary problem. Please try again."