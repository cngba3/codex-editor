#!/usr/bin/env python3
"""Make readable frame sheets for the automated Ghost Editor review gates."""
import argparse
import base64
import io
import json
from html.parser import HTMLParser
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageOps


class ApprovalFrames(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return
        values = dict(attrs)
        src = values.get("src", "")
        if values.get("alt", "").startswith("frame at ") and src.startswith("data:image/jpeg;base64,"):
            self.images.append(Image.open(io.BytesIO(base64.b64decode(src.split(",", 1)[1]))).convert("RGB"))


def frames_from_video(path, times):
    video = cv2.VideoCapture(str(path))
    if not video.isOpened():
        raise RuntimeError(f"Cannot open preview/output video: {path}")
    images = []
    try:
        for time in times:
            video.set(cv2.CAP_PROP_POS_MSEC, max(0, float(time)) * 1000)
            ok, frame = video.read()
            if not ok:
                raise RuntimeError(f"Cannot read video frame at {time:.2f}s: {path}")
            images.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    finally:
        video.release()
    return images


def write_sheets(images, times, prefix):
    if len(images) != len(times) or not images:
        raise RuntimeError("Frame plan and captured images do not match")
    outputs = []
    width, height, label = 340, 604, 34
    for start in range(0, len(images), 12):
        chunk = images[start:start + 12]
        sheet = Image.new("RGB", (width * 4, (height + label) * 3), "#171b22")
        draw = ImageDraw.Draw(sheet)
        for offset, frame in enumerate(chunk):
            index = start + offset
            x, y = (offset % 4) * width, (offset // 4) * (height + label)
            thumb = ImageOps.contain(frame, (width, height))
            sheet.paste(thumb, (x + (width - thumb.width) // 2, y + (height - thumb.height) // 2))
            draw.text((x + 8, y + height + 8), f"#{index + 1:02d}  {float(times[index]):05.2f}s", fill="white")
        output = Path(f"{prefix}-{start // 12 + 1}.jpg")
        sheet.save(output, quality=83, optimize=True)
        outputs.append(str(output))
    print(json.dumps(outputs))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", choices=["approval", "video"])
    parser.add_argument("input")
    parser.add_argument("approval_json")
    parser.add_argument("output_prefix")
    args = parser.parse_args()
    times = [frame["t"] for frame in json.loads(Path(args.approval_json).read_text(encoding="utf-8-sig"))["frames"]]
    if args.source == "approval":
        reader = ApprovalFrames()
        reader.feed(Path(args.input).read_text(encoding="utf-8"))
        images = reader.images
    else:
        images = frames_from_video(args.input, times)
    write_sheets(images, times, args.output_prefix)
