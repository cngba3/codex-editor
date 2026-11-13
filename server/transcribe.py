"""Create ghost-editor compatible word timestamps with local faster-whisper."""

import json
import os
import sys
from pathlib import Path
from faster_whisper import WhisperModel


def main(source: str, destination: str, vocabulary: str = "") -> None:
    cache = Path(__file__).resolve().parents[1] / ".cache"
    candidates = {
        "medium": (cache / "faster-whisper-medium", 1_400_000_000),
        "small": (cache / "faster-whisper-small", 400_000_000),
        "tiny": (cache / "faster-whisper-tiny", 70_000_000),
    }
    snapshots = cache / "models--Systran--faster-whisper-medium" / "snapshots"
    if snapshots.exists():
        for snapshot in snapshots.iterdir():
            if snapshot.is_dir() and (snapshot / "model.bin").exists() and (snapshot / "model.bin").stat().st_size > 1_400_000_000:
                candidates["medium"] = (snapshot, 1_400_000_000)
                break
    requested = os.environ.get("AI_EDITOR_ASR_MODEL", "auto").lower()
    if requested not in ("auto", *candidates):
        raise ValueError("AI_EDITOR_ASR_MODEL must be auto, medium, small, or tiny")
    names = ("medium", "small", "tiny") if requested == "auto" else (requested,)
    ready = [(name, candidates[name][0]) for name in names if
             (candidates[name][0] / "model.bin").exists() and
             (candidates[name][0] / "model.bin").stat().st_size > candidates[name][1]]
    if not ready:
        raise RuntimeError("ASR model missing; run npm run setup:model -- medium (or small)")
    model_name, model_path = ready[0]
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        source,
        beam_size=5,
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
        multilingual=True,
        initial_prompt=vocabulary[:200] or None,
    )
    output = {"language": info.language, "model": model_name, "segments": []}
    for segment in segments:
        words = [
            {"word": word.word, "start": round(word.start, 3), "end": round(word.end, 3)}
            for word in (segment.words or [])
        ]
        output["segments"].append({
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "text": segment.text,
            "avg_logprob": round(segment.avg_logprob, 3),
            "words": words,
        })
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)
    print(f"Transcribed {len(output['segments'])} segments ({info.language}, {model_name})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
