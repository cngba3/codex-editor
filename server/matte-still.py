#!/usr/bin/env python3
"""Remove the background from one talking-head frame for a short clone pop."""
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

if len(sys.argv) != 3:
    raise SystemExit('usage: matte-still.py INPUT.png OUTPUT.png')

source, target = map(Path, sys.argv[1:])
frame = Image.open(source).convert('RGB')
cutout = remove(frame, session=new_session('birefnet-portrait'))
cutout.save(target)
