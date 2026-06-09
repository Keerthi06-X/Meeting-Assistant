import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import aiofiles
import filetype
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, func, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

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
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_format = Column(String, nullable=False)
    status = Column(String, default="uploaded")
    transcript = Column(Text, nullable=True)
    transcribed_at = Column(DateTime, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# ── Schema migration: add transcript columns to existing DBs ──────────────────
def _migrate():
    with engine.connect() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(meetings)"))}
        if "transcript" not in cols:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN transcript TEXT"))
        if "transcribed_at" not in cols:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN transcribed_at DATETIME"))
        conn.commit()

_migrate()

# ── Constants ─────────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a", "mp4"}
ALLOWED_MIME_PREFIXES = {"audio/", "video/mp4", "video/x-m4v"}
FORMAT_LABELS = {"mp3": "MP3", "wav": "WAV", "m4a": "M4A", "mp4": "MP4"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ── Mock transcript templates ─────────────────────────────────────────────────
_MOCK_TRANSCRIPTS = [
    """\
[00:00:03] Sarah Chen: Good morning everyone. Let's get started — we have a packed agenda today.

[00:00:10] Marcus Reid: Morning. Before we jump in, can we quickly confirm who owns the Q3 roadmap review?

[00:00:18] Sarah Chen: That's on me and Priya. We'll walk through it in the second half of this call.

[00:00:24] Priya Nair: Yes, I'll share my screen when we get there. I've updated the slides since last week.

[00:00:31] James Liu: Quick heads-up — the engineering estimates on slide 14 are stale. I sent revised numbers yesterday.

[00:00:40] Sarah Chen: Got it, James. We'll use your revised numbers. Let's start with the sprint retrospective. Marcus, do you want to kick that off?

[00:00:49] Marcus Reid: Sure. Overall the sprint went well. We shipped the notification service on time and the auth refactor is 90% done. The one miss was the analytics dashboard — we underestimated the data pipeline work.

[00:01:02] James Liu: Agreed. The pipeline complexity wasn't visible until we dug in. I'd say we need to add a spike task before committing to timelines on data-heavy features going forward.

[00:01:15] Sarah Chen: That's a good process note. Can you add that to the team wiki, James?

[00:01:20] James Liu: On it.

[00:01:22] Priya Nair: On the auth refactor — we found two edge cases in the token refresh flow that need a decision. Do we want to extend the session silently or force re-login after 24 hours of inactivity?

[00:01:36] Marcus Reid: I'd lean toward silent refresh. The user research from last quarter was pretty clear that forced logouts are a top frustration.

[00:01:45] Sarah Chen: Agreed. Let's go with silent refresh. Priya, make sure that's documented in the security ticket.

[00:01:51] Priya Nair: Will do.

[00:01:54] Sarah Chen: Okay, let's move to the roadmap review. Priya, over to you.

[00:02:00] Priya Nair: Thanks. So for Q3 we have three major themes: performance, mobile parity, and the new reporting module. Performance is already in flight — James's team has the memory profiling work. Mobile parity is where I want to focus today because it's the most at-risk.

[00:02:19] James Liu: What's the risk vector? Timeline or scope?

[00:02:23] Priya Nair: Scope. The design team expanded the feature set after the last customer advisory board. We're now looking at offline mode and push notifications, which weren't in the original estimate.

[00:02:36] Marcus Reid: Offline mode is a significant lift. That's probably a three-week effort on its own.

[00:02:43] Sarah Chen: Do we have flexibility to phase it? Ship mobile parity without offline, then add it in Q4?

[00:02:51] Priya Nair: I think that's the right call. I'll flag it in the roadmap as a Q4 dependency.

[00:02:58] James Liu: Works for me. Push notifications we can probably fit in — it's maybe a week of work if we use the existing infrastructure.

[00:03:07] Sarah Chen: Let's lock that in. Mobile parity ships in Q3 with push notifications. Offline mode moves to Q4. Any objections?

[00:03:16] Marcus Reid: No objections. I'll update the JIRA epics after this call.

[00:03:21] Sarah Chen: Perfect. Last item — budget review. I'll be brief. We're on track overall. The only overage is cloud infra, up 12% month-over-month due to the load testing we ran. That should normalize next month.

[00:03:36] James Liu: Should we set an alert threshold? Something like a 10% week-over-week spike triggers a review?

[00:03:44] Sarah Chen: Yes, good idea. Marcus, can you work with DevOps to set that up?

[00:03:49] Marcus Reid: Yep, I'll get that done by end of week.

[00:03:53] Sarah Chen: Great. That covers everything. Thanks all — good meeting. Next call same time next week.

[00:03:59] All: Thanks, bye.
""",
    """\
[00:00:05] David Park: Alright, we're recording. Let's do a quick round of updates. Emily, want to start?

[00:00:12] Emily Torres: Sure. Design is wrapping up the onboarding flow redesign. We have three concepts ready for review — I'll drop the Figma link in Slack after this call. Would love feedback by Thursday.

[00:00:25] David Park: Perfect. I'll block time Thursday afternoon to review. Raj, what's the status on the API integration?

[00:00:33] Raj Patel: We hit a snag with the third-party auth provider. Their sandbox environment has been flaky all week — we've had to mock parts of the flow to keep unblocked. I expect we'll lose two to three days once their environment stabilizes.

[00:00:48] David Park: Is there a risk to the release date?

[00:00:52] Raj Patel: Low risk if their environment is back up by Monday. I'd say medium risk if we're still blocked Thursday.

[00:01:00] Emily Torres: Is there anything design can do to help absorb slack? We're currently ahead on the onboarding work.

[00:01:08] Raj Patel: Actually yes — we need error state designs for the auth flow. Four scenarios. I can send you the specs today.

[00:01:16] Emily Torres: Send them over. I can have those back to you Wednesday.

[00:01:21] David Park: Good coordination. Raj, keep me posted Monday morning on the vendor status. If we're still blocked I'll escalate to their account team.

[00:01:30] Raj Patel: Understood.

[00:01:33] David Park: Next — customer feedback from last week's beta. We had 47 responses. Top theme was load time on the dashboard, mentioned by 31% of respondents. Second was the search experience — people want filters.

[00:01:49] Emily Torres: The filter work is already in our backlog. I can bump it up if we want to address it this sprint.

[00:01:56] David Park: Let's discuss prioritization offline — I don't want to derail the sprint mid-cycle. But load time we should address now. Raj, is that something your team can look at?

[00:02:07] Raj Patel: We have a rough idea of where the bottleneck is — it's the initial data fetch. We're making four sequential calls where we could do three in parallel. Quick win, probably a day of work.

[00:02:19] David Park: Do it. That should meaningfully move the metric. Alright, anything else before we wrap?

[00:02:26] Emily Torres: One small thing — can we get a decision on the icon library? We've been mixing Heroicons and Lucide and it's creating inconsistency.

[00:02:35] David Park: Strong preference on the team?

[00:02:38] Raj Patel: Either works for me. I'd just pick one and stick to it.

[00:02:42] Emily Torres: I prefer Lucide — better React support and more consistent stroke weight.

[00:02:48] David Park: Lucide it is. Emily, document that in the design system page and I'll announce it to the broader team.

[00:02:55] Emily Torres: Done by end of day.

[00:02:58] David Park: Alright, that's a wrap. Good work everyone.
""",
    """\
[00:00:02] Alex Morgan: Hi everyone, thanks for joining the emergency sync. I'll keep this tight — thirty minutes max.

[00:00:09] Nina Scott: What's the severity level we're operating at right now?

[00:00:13] Alex Morgan: Sev-2. The payment processing service has been returning 503s for about 40% of checkout attempts in the EU region. Started at 09:14 UTC. About 1,200 failed transactions so far.

[00:00:27] Tom Berger: I've been in the logs. It looks like the issue is downstream — the payment gateway is rate limiting us unexpectedly. Our retry logic is making it worse by hammering the endpoint.

[00:00:40] Alex Morgan: Can we throttle our retry attempts?

[00:00:44] Tom Berger: Yes. I have a one-line config change ready. It'll reduce retries from 5 attempts to 2 and add exponential backoff. I can deploy in five minutes.

[00:00:54] Alex Morgan: Get that deployed now. Nina, can you monitor the error rate as Tom deploys?

[00:01:00] Nina Scott: Already on the dashboard. I'll call out any movement.

[00:01:04] Tom Berger: Deploying now.

[00:01:18] Nina Scott: Error rate is dropping. Down to 28%... 19%... holding around 12%. Still elevated but trending down.

[00:01:30] Tom Berger: The backoff is working. I think the gateway was being overwhelmed by our retries. Give it another five minutes and it should normalize.

[00:01:40] Alex Morgan: Good. What about the failed transactions — do we need to trigger re-attempts for customers?

[00:01:47] Tom Berger: Most customers would have seen an error and retried manually. But we should identify any orders that were marked as failed on our side but may have succeeded on the gateway side.

[00:02:00] Nina Scott: I can run that reconciliation query. Might take 20 minutes to write and run safely.

[00:02:07] Alex Morgan: Do it. Flag anything that looks like a double-charge risk as highest priority. We'll handle those manually before any automated recovery.

[00:02:16] Nina Scott: On it.

[00:02:19] Alex Morgan: Tom, once the error rate is back under 2% for five consecutive minutes, send me the all-clear and I'll update the status page.

[00:02:28] Tom Berger: Will do. Error rate is at 8% now.

[00:02:34] Alex Morgan: Good trajectory. Let's stay on this call until we're clear. Everyone else hold tight.

[00:02:41] Nina Scott: 6%... 4%...

[00:02:48] Tom Berger: 3%... 2%. Holding at 1.8%.

[00:02:55] Alex Morgan: That's our threshold. Tom, send the all-clear. I'm updating the status page now. Nina, keep that reconciliation query running in the background.

[00:03:05] Tom Berger: All-clear sent.

[00:03:08] Nina Scott: Query is running. I'll have results in 15 minutes.

[00:03:13] Alex Morgan: Great work everyone. We'll do a full post-mortem tomorrow at 10 AM. Tom, please write up the timeline and your fix before then.

[00:03:22] Tom Berger: Already drafting it.

[00:03:25] Alex Morgan: Alright — incident resolved. Thank you all.
""",
]


def _generate_mock_transcript(original_filename: str) -> str:
    """Return a realistic mock transcript seeded from the filename."""
    idx = hash(original_filename) % len(_MOCK_TRANSCRIPTS)
    return _MOCK_TRANSCRIPTS[idx].strip()


# ── Background transcription task ────────────────────────────────────────────
async def _run_transcription(meeting_id: int, file_path: Path, original_filename: str):
    """Transcribe a meeting audio file. Uses OpenAI Whisper if key is set, else mock."""
    db: Session = SessionLocal()
    try:
        record = db.query(MeetingRecord).filter(MeetingRecord.id == meeting_id).first()
        if not record:
            return

        # Mark as transcribing
        record.status = "transcribing"
        db.commit()

        if OPENAI_API_KEY:
            try:
                import openai  # type: ignore

                client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
                async with aiofiles.open(file_path, "rb") as audio_file:
                    audio_bytes = await audio_file.read()

                response = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=(original_filename, audio_bytes),
                )
                transcript = response.text
            except Exception as exc:
                # Fall back to mock on any OpenAI error
                await asyncio.sleep(random.uniform(3.0, 6.0))
                transcript = _generate_mock_transcript(original_filename)
                transcript += f"\n\n[Note: OpenAI transcription failed ({exc}). Showing simulated transcript.]"
        else:
            # Simulate processing time (3–7 seconds)
            await asyncio.sleep(random.uniform(3.0, 7.0))
            transcript = _generate_mock_transcript(original_filename)

        # Persist result
        db.refresh(record)
        record.transcript = transcript
        record.transcribed_at = datetime.utcnow()
        record.status = "transcribed"
        db.commit()

    except Exception:
        db.refresh(record)
        record.status = "failed"
        db.commit()
    finally:
        db.close()


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
    ext = Path(filename).suffix.lstrip(".").lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Allowed: MP3, WAV, M4A, MP4.",
        )
    kind = filetype.guess(content[:4096])
    if kind is not None:
        mime = kind.mime
        allowed = any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES)
        if not allowed and "audio" not in mime and "mp4" not in mime:
            raise HTTPException(
                status_code=400,
                detail=f"File content does not match an audio format (detected: {mime}).",
            )
    return FORMAT_LABELS.get(ext, ext.upper())


def _meeting_to_dict(m: MeetingRecord) -> dict:
    return {
        "id": m.id,
        "filename": m.filename,
        "original_filename": m.original_filename,
        "file_size": m.file_size,
        "file_format": m.file_format,
        "status": m.status,
        "transcript": m.transcript,
        "transcribed_at": m.transcribed_at.isoformat() if m.transcribed_at else None,
        "uploaded_at": m.uploaded_at.isoformat(),
    }


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
        rows = db.query(MeetingRecord.file_format, func.count(MeetingRecord.id)).group_by(
            MeetingRecord.file_format
        ).all()
        formats = {row[0]: row[1] for row in rows}
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
        return [_meeting_to_dict(m) for m in meetings]
    finally:
        db.close()


@app.post("/meetings/upload", status_code=201)
async def upload_meeting(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB limit.")

    fmt_label = validate_audio_file(file.filename or "upload", content)

    ext = Path(file.filename or "upload").suffix
    stored_name = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / stored_name

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

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
        meeting_id = record.id
        original_filename = record.original_filename
        result = _meeting_to_dict(record)
    finally:
        db.close()

    # Kick off transcription in the background
    background_tasks.add_task(_run_transcription, meeting_id, dest, original_filename)

    return result


@app.post("/meetings/{id}/transcribe")
def retry_transcription(id: int, background_tasks: BackgroundTasks):
    db: Session = SessionLocal()
    try:
        m = db.query(MeetingRecord).filter(MeetingRecord.id == id).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"Meeting {id} not found.")
        if m.status == "transcribing":
            raise HTTPException(status_code=409, detail="Transcription already in progress.")
        file_path = UPLOAD_DIR / m.filename
        original_filename = m.original_filename
    finally:
        db.close()

    background_tasks.add_task(_run_transcription, id, file_path, original_filename)
    return {"message": "Transcription started."}


@app.get("/meetings/{id}")
def get_meeting(id: int):
    db: Session = SessionLocal()
    try:
        m = db.query(MeetingRecord).filter(MeetingRecord.id == id).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"Meeting {id} not found.")
        return _meeting_to_dict(m)
    finally:
        db.close()


@app.delete("/meetings/{id}")
def delete_meeting(id: int):
    db: Session = SessionLocal()
    try:
        m = db.query(MeetingRecord).filter(MeetingRecord.id == id).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"Meeting {id} not found.")
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
