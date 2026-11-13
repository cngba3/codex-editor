"""Reconstruct the SFX-only audio stem from rendered composition declarations.
Uses the same source trim, gain and delay as the static SFX audio tracks. Refuses
automation rather than silently measuring the wrong mix. No picture re-render.
"""
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys


class Tracks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tracks = []
        self.duration = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'data-composition-id' in a:
            self.duration = float(a['data-duration'])
        if tag == 'audio' and ('/sfx/' in a.get('src', '').replace('\\', '/') or a.get('id', '').startswith('sfx')):
            self.tracks.append(a)


def stem(directory):
    project = Path(directory).resolve()
    parser = Tracks()
    parser.feed((project / 'index.html').read_text(encoding='utf-8'))
    if not parser.duration:
        raise ValueError('Missing composition duration')
    command = ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo:d={parser.duration}']
    filters = []
    for index, track in enumerate(parser.tracks, 1):
        source = (project / track['src']).resolve()
        if not source.is_relative_to(project) or not source.is_file():
            raise ValueError('Invalid SFX source')
        if track.get('data-automation') or float(track.get('data-playback-rate', 1)) != 1:
            raise ValueError('SFX automation needs an audio-engine stem, not a static mix')
        command += ['-i', str(source)]
        start, duration = float(track.get('data-media-start', 0)), float(track['data-duration'])
        gain = float(track.get('data-volume', 1))
        delay = round(float(track.get('data-start', 0)) * 1000)
        filters.append(f'[{index}:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,volume={gain},adelay={delay}|{delay}[s{index}]')
    if filters:
        filters.append('[0:a]' + ''.join(f'[s{i}]' for i in range(1, len(parser.tracks) + 1)) + f'amix=inputs={len(parser.tracks) + 1}:normalize=0:duration=first[out]')
        graph = project / 'build/sfx-stem.ffscript'
        graph.write_text(';\n'.join(filters), encoding='utf-8')
        command += ['-filter_complex_script', str(graph), '-map', '[out]']
    else:
        command += ['-map', '0:a']
    command += ['-t', str(parser.duration), '-ar', '48000', '-c:a', 'pcm_f32le', str(project / 'build/sfx-stem.wav')]
    subprocess.run(command, check=True)
    print(json.dumps({'sfxTracks': len(parser.tracks), 'duration': parser.duration}))


if __name__ == '__main__':
    stem(sys.argv[1])
