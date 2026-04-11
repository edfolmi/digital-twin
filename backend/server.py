from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from openai import AsyncOpenAI, APIError, APIStatusError, AuthenticationError, RateLimitError

from context import prompt

load_dotenv()

app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
_openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
openai_client: AsyncOpenAI | None
if _openai_api_key:
    openai_client = AsyncOpenAI(api_key=_openai_api_key)
else:
    openai_client = None

USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "../memory")

if USE_S3:
    s3_client = boto3.client("s3")


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class Message(BaseModel):
    role: str
    content: str
    timestamp: str


def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def load_conversation(session_id: str) -> List[Dict]:
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise
    else:
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return json.load(f)
        return []


def save_conversation(session_id: str, messages: List[Dict]):
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(messages, indent=2),
            ContentType="application/json",
        )
    else:
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)


def _conversation_to_openai_messages(conversation: List[Dict], user_message: str) -> List[Dict[str, str]]:
    """Build Chat Completions message list: system + history (user/assistant only) + latest user turn."""
    messages: List[Dict[str, str]] = [{"role": "system", "content": prompt()}]
    for msg in conversation[-50:]:
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        content = msg.get("content")
        if content is None:
            continue
        text = str(content).strip()
        if not text:
            continue
        messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": user_message.strip()})
    return messages


async def call_openai(conversation: List[Dict], user_message: str) -> str:
    if openai_client is None:
        raise HTTPException(
            status_code=503,
            detail="OpenAI is not configured (missing OPENAI_API_KEY).",
        )

    messages = _conversation_to_openai_messages(conversation, user_message)

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            max_tokens=2000,
            temperature=0.7,
            top_p=0.9,
        )
    except AuthenticationError as e:
        print(f"OpenAI authentication error: {e}")
        raise HTTPException(
            status_code=502,
            detail="OpenAI authentication failed. Check API key configuration.",
        ) from e
    except RateLimitError as e:
        print(f"OpenAI rate limit: {e}")
        raise HTTPException(
            status_code=429,
            detail="The model is temporarily rate-limited. Please try again shortly.",
        ) from e
    except APIStatusError as e:
        print(f"OpenAI API error ({e.status_code}): {e}")
        detail = getattr(e, "message", None) or str(e)
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI request failed: {detail}",
        ) from e
    except APIError as e:
        print(f"OpenAI error: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI error: {str(e)}",
        ) from e

    choice = response.choices[0].message
    text = (choice.content or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty response.")
    return text


@app.get("/")
async def root():
    return {
        "message": "Career digital twin API",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "ai_model": OPENAI_MODEL,
        "ai_provider": "openai",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "use_s3": USE_S3,
        "openai_model": OPENAI_MODEL,
        "openai_configured": openai_client is not None,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        conversation = load_conversation(session_id)
        assistant_response = await call_openai(conversation, request.message)

        conversation.append(
            {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
        )
        conversation.append(
            {
                "role": "assistant",
                "content": assistant_response,
                "timestamp": datetime.now().isoformat(),
            }
        )
        save_conversation(session_id, conversation)

        return ChatResponse(response=assistant_response, session_id=session_id)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
