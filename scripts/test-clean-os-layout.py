"""Regression: opening text must move above the head when the face fills the lower safe band."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ghost-editor/recipes/clean-os"))
from cleanos import CleanOS  # noqa: E402


def test_opening_row_avoids_face():
    reel = CleanOS.__new__(CleanOS)
    reel.T = 1.0
    reel.push = 0.0
    reel.face = [
        [0.0, 603, 1414, 87, 592, 1010, 1218],
        [0.2, 506, 1483, 0, 513, 1000, 1252],
        [0.4, 492, 1494, 0, 503, 995, 1253],
        [0.6, 582, 1414, 28, 557, 978, 1190],
        [0.8, 620, 1322, 227, 648, 947, 1123],
    ]
    top = reel.text_top(0, .84, 130, 1450)
    assert 220 <= top <= 350, top
    for sample in reel.face:
        if 0.05 <= sample[0] <= .79:
            face = reel.face_at(sample)
            assert top + 130 <= face[1] - 9, (top, face)


if __name__ == '__main__':
    test_opening_row_avoids_face()
