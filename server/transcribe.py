"""Create ghost-editor compatible word timestamps with local faster-whisper."""

import json
import sys
from pathlib import Path
from faster_whisper import WhisperModel


def main(source: str, destination: str) -> None:
    cache = Path(__file__).resolve().parents[1] / ".cache"
    small = cache / "faster-whisper-small"
    model_file = small / "model.bin"
    model_path = small if model_file.exists() and model_file.stat().st_size > 400_000_000 else cache / "faster-whisper-tiny"
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
    segments, info = model.transcribe(source, beam_size=3, word_timestamps=True, vad_filter=True)
    output = {"language": info.language, "segments": []}
    for segment in segments:
        words = [
            {"word": word.word, "start": round(word.start, 3), "end": round(word.end, 3)}
            for word in (segment.words or [])
        ]
        output["segments"].append({
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "text": segment.text,
            "words": words,
        })
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)
    print(f"Transcribed {len(output['segments'])} segments ({info.language})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
