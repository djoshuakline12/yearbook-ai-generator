#!/usr/bin/env python3
"""Detect face bounding boxes for every photo the spread editor uses.

Detection only — no identification, no embeddings kept. The editor uses
the boxes to warn when a crop pushes a person out of frame; naming stays
a human job (face_review workflow).

Reads  yearbook_import_pack/_review/editor_photos.json  ({base: filepath})
Writes yearbook_import_pack/_review/face_boxes.json     ({base: [{x,y,w,h}]},
                                                         fractions of image size)

Needs insightface + onnxruntime + opencv-python-headless in the running
python (see the facenv virtualenv used by the caption pipeline).
"""
import json
import os
import sys

import cv2
from insightface.app import FaceAnalysis

PACK = os.path.expanduser("~/Downloads/yearbook_import_pack")
IN = os.path.join(PACK, "_review", "editor_photos.json")
OUT = os.path.join(PACK, "_review", "face_boxes.json")

files = json.load(open(IN))
app = FaceAnalysis(name="buffalo_l", allowed_modules=["detection"],
                   providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(960, 960))

out = {}
for base, fp in files.items():
    im = cv2.imread(fp)
    if im is None:
        continue
    h, w = im.shape[:2]
    scale = 1600 / max(h, w) if max(h, w) > 1600 else 1.0
    im2 = cv2.resize(im, (int(w * scale), int(h * scale))) if scale < 1.0 else im
    boxes = []
    for f in app.get(im2):
        x1, y1, x2, y2 = [float(v) / scale for v in f.bbox]
        if (x2 - x1) < 30:  # skip tiny background faces
            continue
        boxes.append({
            "x": round(max(0, x1) / w, 4), "y": round(max(0, y1) / h, 4),
            "w": round((x2 - x1) / w, 4), "h": round((y2 - y1) / h, 4),
        })
    out[base] = boxes
    print(f"{base}: {len(boxes)} faces", file=sys.stderr)

json.dump(out, open(OUT, "w"))
print(f"wrote {OUT} ({len(out)} photos)")
