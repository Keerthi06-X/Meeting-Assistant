import os
import uuid
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

import aiofiles
import filetype
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ── Database setup ────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

DB_PATH = BASE_DIR / "meetings.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class MeetingRecord(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)          # stored name on disk
    original_filename = Column(String, nullable=False)  # user's original name
    file_size = Column(Integer, nullable=False)
    file_format = Column(String, nullable=False)        # mp3 / wav / m4a / mp4
    status = Column(String, default="uploaded")
    uploaded_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Constants ─────────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a", "mp4"}

# Allowed MIME types from filetype library
ALLOWED_MIME_PREFIXES = {"audio/", "video/mp4", "video/x-m4v"}

# Extension → display format label
FORMAT_LABELS = {
    "mp3": "MP3",
    "wav": "WAV",
    "m4a": "M4A",
    "mp4": "MP4",
}

MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Smart Meeting Assistant API", root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_audio_file(filename: str, content: bytes) -> str:
    """Validate file extension and magic bytes. Returns the detected format label."""
    ext = Path(filename).suffix.lstrip(".").lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Allowed: MP3, WAV, M4A, MP4.",
        )

    # Verify magic bytes with filetype library
    kind = filetype.guess(content[:4096])
    if kind is None:
        # Fall back to extension-only validation for formats filetype may miss (e.g. WAV)
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Could not determine file type.")
    else:
        mime = kind.mime
        is_allowed = any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES)
        # Also allow wav (audio/x-wav, audio/vnd.wave) and m4a (audio/x-m4a, audio/mp4)
        if not is_allowed and "audio" not in mime and "mp4" not in mime:
            raise HTTPException(
                status_code=400,
                detail=f"File content does not match an allowed audio format (detected: {mime}).",
            )

    return FORMAT_LABELS.get(ext, ext.upper())


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/healthz")
def health_check():
    return {"status": "ok"}


@app.get("/meetings/stats")
def get_meeting_stats():
    db: Session = SessionLocal()
    try:
        total = db.query(func.count(MeetingRecord.id)).scalar() or 0
        total_size = db.query(func.sum(MeetingRecord.file_size)).scalar() or 0

        # Counts per format
        rows = db.query(MeetingRecord.file_format, func.count(MeetingRecord.id)).group_by(
            MeetingRecord.file_format
        ).all()
        formats = {row[0]: row[1] for row in rows}

        # Uploads in last 7 days
        cutoff = datetime.utcnow() - timedelta(days=7)
        recent = db.query(func.count(MeetingRecord.id)).filter(
            MeetingRecord.uploaded_at >= cutoff
        ).scalar() or 0

        return {
            "total_meetings": total,
            "total_size_bytes": total_size,
            "formats": formats,
            "recent_uploads": recent,
        }
    finally:
        db.close()


@app.get("/meetings")
def list_meetings():
    db: Session = SessionLocal()
    try:
        meetings = db.query(MeetingRecord).order_by(MeetingRecord.uploaded_at.desc()).all()
        return [
            {
                "id": m.id,
                "filename": m.filename,
                "original_filename": m.original_filename,
                "file_size": m.file_size,
                "file_format": m.file_format,
                "status": m.status,
                "uploaded_at": m.uploaded_at.isoformat(),
            }
            for m in meetings
        ]
    finally:
        db.close()


@app.post("/meetings/upload", status_code=201)
async def upload_meeting(file: UploadFile = File(...)):
    """Upload a meeting audio file. Validates format before saving."""
    # Read file into memory for validation
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB limit.")

    fmt_label = validate_audio_file(file.filename or "upload", content)

    # Persist to disk
    ext = Path(file.filename or "upload").suffix
    stored_name = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / stored_name

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    # Save record
    db: Session = SessionLocal()
    try:
        record = MeetingRecord(
            filename=stored_name,
            original_filename=file.filename or stored_name,
            file_size=len(content),
            file_format=fmt_label,
            status="uploaded",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {
            "id": record.id,
            "filename": record.filename,
            "original_filename": record.original_filename,
            "file_size": record.file_size,
            "file_format": record.file_format,
            "status": record.status,
            "uploaded_at": record.uploaded_at.isoformat(),
        }
    finally:
        db.close()


@app.get("/meetings/{id}")
def get_meeting(id: int):
    db: Session = SessionLocal()
    try:
        m = db.query(MeetingRecord).filter(MeetingRecord.id == id).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"Meeting {id} not found.")
        return {
            "id": m.id,
            "filename": m.filename,
            "original_filename": m.original_filename,
            "file_size": m.file_size,
            "file_format": m.file_format,
            "status": m.status,
            "uploaded_at": m.uploaded_at.isoformat(),
        }
    finally:
        db.close()


@app.delete("/meetings/{id}")
def delete_meeting(id: int):
    db: Session = SessionLocal()
    try:
        m = db.query(MeetingRecord).filter(MeetingRecord.id == id).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"Meeting {id} not found.")
        # Remove file from disk
        file_path = UPLOAD_DIR / m.filename
        if file_path.exists():
            file_path.unlink()
        db.delete(m)
        db.commit()
        return {"message": f"Meeting {id} deleted."}
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
