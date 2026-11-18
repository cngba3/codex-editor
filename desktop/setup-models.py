"""Download once, validate locally on later launches; never rely on global caches."""
import json
import os
import sys
import hashlib
import time
from pathlib import Path
from urllib.request import urlopen, Request

root = Path.cwd()
asr = root / '.cache' / 'faster-whisper-small'
face = root / 'ghost-editor/library/models/face_detection_yunet_2023mar.onnx'
matte = Path(os.environ['U2NET_HOME']) / 'models/birefnet-portrait/birefnet-portrait.onnx'
files = ['config.json', 'tokenizer.json', 'vocabulary.txt', 'model.bin']
revision = '536b0662742c02347bc0e980a01041f333bce120'
sizes = {'config.json': 2370, 'tokenizer.json': 2203239, 'vocabulary.txt': 459861, 'model.bin': 483546902}
hashes = {
    'config.json': 'b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828',
    'tokenizer.json': 'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab',
    'vocabulary.txt': '34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913',
    'model.bin': '3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671',
}

def download(url, target, size=None, digest=None, algorithm='sha256'):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and (size is None or target.stat().st_size == size):
        if not digest:
            return
        with target.open('rb') as handle:
            if hashlib.file_digest(handle, algorithm).hexdigest() == digest:
                return
    temp = target.with_suffix(target.suffix + '.partial')
    if temp.is_file() and digest:
        with temp.open('rb') as handle:
            complete = hashlib.file_digest(handle, algorithm).hexdigest() == digest
        if complete:
            temp.replace(target)
            return
    for attempt in range(3):
        try:
            offset = temp.stat().st_size if temp.exists() else 0
            request = Request(url, headers={'Range': f'bytes={offset}-'} if offset else {})
            with urlopen(request, timeout=120) as response:
                append = offset > 0 and response.status == 206
                done = offset if append else 0
                total = size or done + int(response.headers.get('Content-Length', 0))
                last = 0
                with temp.open('ab' if append else 'wb') as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                        done += len(chunk)
                        if time.monotonic() - last > 1:
                            print(f'{target.name}: {done // 1048576} / {total // 1048576} MB', flush=True)
                            last = time.monotonic()
            if size and temp.stat().st_size != size:
                raise RuntimeError(f'{target.name}: kích thước chưa đủ')
            if digest:
                with temp.open('rb') as handle:
                    if hashlib.file_digest(handle, algorithm).hexdigest() != digest:
                        temp.unlink()
                        raise RuntimeError(f'{target.name}: checksum mismatch')
            temp.replace(target)
            return
        except Exception as error:
            if getattr(error, 'code', None) == 416:
                temp.unlink(missing_ok=True)
            if attempt == 2:
                raise
            print(f'Thử lại {target.name} ({attempt + 1}/3)', flush=True)
            time.sleep(2)

def asr_ready():
    return all((asr / f).is_file() and (asr / f).stat().st_size == sizes[f] for f in files)

if sys.argv[1] == 'asr':
    for file in files:
        download(f'https://huggingface.co/Systran/faster-whisper-small/resolve/{revision}/{file}', asr / file, sizes[file],
                 hashes[file])
    # Loading also detects incomplete/corrupt weights rather than trusting a size-only marker.
    from faster_whisper import WhisperModel
    WhisperModel(str(asr), device='cpu', compute_type='int8', local_files_only=True)
    print('Whisper small OK', flush=True)
elif sys.argv[1] == 'vision':
    import cv2
    download('https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx', face,
             digest='8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4')
    cv2.FaceDetectorYN.create(str(face), '', (320, 320))
    download('https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx',
             matte, digest='c3a64a6abf20250d090cd055f12a3b67', algorithm='md5')
    from rembg import new_session
    new_session('birefnet-portrait', providers=['CPUExecutionProvider'])
    print('YuNet + BiRefNet portrait OK', flush=True)
elif sys.argv[1] == 'check':
    if not asr_ready() or not face.is_file() or not matte.is_file():
        raise RuntimeError('Thiếu model. Hãy nhấn Thử lại để hoàn tất thiết lập.')
    json.loads((asr / 'config.json').read_text(encoding='utf-8'))
    print('Models OK', flush=True)
