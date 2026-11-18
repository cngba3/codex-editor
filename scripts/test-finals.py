import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / "ghost-editor" / "scripts"
sys.path.insert(0, str(SCRIPTS))
import finals


class FinalsErrors(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ai-editor-finals-")
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.reel = {"project": self.temp.name, "out": self.temp.name, "name": "reel"}
        (self.directory / "index.html").write_text("<div></div>", encoding="utf-8")

    def test_preview_failure_is_nonzero_and_contains_browser_cause(self):
        code = """
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import finals
def failed(r, quality, dst, log):
    Path(log).write_text('Chrome cannot start: ETIMEDOUT', encoding='utf-8')
    return False
finals.hf_render = failed
finals.preview({'project': sys.argv[2], 'out': sys.argv[2], 'name': 'reel'})
"""
        result = subprocess.run([sys.executable, "-c", code, str(SCRIPTS), self.temp.name], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Chrome cannot start: ETIMEDOUT", result.stderr)

    def test_failed_encode_preserves_previous_preview_but_raises(self):
        preview = self.directory / "reel (preview).mp4"
        preview.write_bytes(b"previous preview")
        def failed(cmd, log=None, cwd=None):
            Path(log).write_text("FFmpeg: invalid data", encoding="utf-8")
            return 1
        with patch.object(finals, "hf_render", return_value=True), patch.object(finals, "run", side_effect=failed):
            with self.assertRaisesRegex(RuntimeError, "FFmpeg: invalid data"):
                finals.preview(self.reel)
        self.assertEqual(preview.read_bytes(), b"previous preview")

    def test_previous_draft_cannot_be_mistaken_for_a_new_render(self):
        draft = self.directory / ".draft-reel.mp4"
        draft.write_bytes(b"old draft")
        with patch.object(finals, "run", return_value=0):
            self.assertFalse(finals.hf_render(self.reel, "looks", str(draft), str(self.directory / "test.log")))
        self.assertFalse(draft.exists())

    def test_final_requires_a_current_preview(self):
        with self.assertRaisesRegex(RuntimeError, "no preview of the current build"):
            finals.render(self.reel)


if __name__ == "__main__":
    unittest.main()
