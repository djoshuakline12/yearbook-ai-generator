#!/usr/bin/env python3
"""Propose names for photos listed in _review/nameless_targets.json.

Matches faces against the RenWeb portrait set and writes
_review/face_proposals.json for build-face-review.py. Proposals only —
every printed name is verified by a human on the review page.

Run inside the face venv (insightface + onnxruntime + opencv).
"""
import json
import os
import sys

import cv2
import numpy as np
from insightface.app import FaceAnalysis

PACK = os.path.expanduser("~/Downloads/yearbook_import_pack")
REF_DIR = os.path.expanduser(
    "~/Downloads/F262 - DELMARVA CHRISTIAN HIGH SCHOOL 4566 RenWeb 2025-10-24")

targets = json.load(open(os.path.join(PACK, "_review", "nameless_targets.json")))

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(960, 960))

import csv
people = {}
with open(os.path.join(REF_DIR, "DataFile.csv"), encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        img = row["images"].strip()
        if img:
            people[img] = {"name": f'{row["First Name"].strip()} {row["Last Name"].strip()}',
                           "grade": row["Grade"].strip()}

ref_names, ref_vecs = [], []
for img, info in people.items():
    p = os.path.join(REF_DIR, img)
    im = cv2.imread(p)
    if im is None:
        continue
    faces = app.get(im)
    if not faces:
        continue
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    ref_names.append(info)
    ref_vecs.append(face.normed_embedding)
print(f"references encoded: {len(ref_vecs)}", file=sys.stderr)
R = np.stack(ref_vecs)

results = []
for folder, photos in targets.items():
    for ph in photos:
        im = cv2.imread(ph["file"])
        if im is None:
            continue
        h, w = im.shape[:2]
        scale = 1600 / max(h, w) if max(h, w) > 1600 else 1.0
        im2 = cv2.resize(im, (int(w * scale), int(h * scale))) if scale < 1.0 else im
        entries = []
        for f in app.get(im2):
            x1, y1, x2, y2 = [float(v) / scale for v in f.bbox]
            sims = R @ f.normed_embedding
            best = int(np.argmax(sims))
            s = float(sims[best])
            info = ref_names[best]
            conf = "high" if s >= 0.40 else ("low" if s >= 0.28 else "none")
            entries.append({
                "box": [round(x1), round(y1), round(x2), round(y2)],
                "w": round(x2 - x1),
                "name": info["name"] if conf != "none" else "",
                "grade": info["grade"] if conf != "none" else "",
                "sim": round(s, 3), "conf": conf,
            })
        entries = [e for e in entries if e["w"] >= 45 or e["conf"] == "high"]
        entries.sort(key=lambda e: e["box"][0])
        results.append({"folder": folder, "rel": ph["rel"], "file": ph["file"],
                        "width": w, "height": h, "faces": entries})
        named = [e["name"] for e in entries if e["name"]]
        print(f'{folder}/{ph["rel"]}: {len(entries)} faces — {", ".join(named) if named else "-"}',
              file=sys.stderr)

json.dump(results, open(os.path.join(PACK, "_review", "face_proposals.json"), "w"), indent=1)
print(f"wrote face_proposals.json ({len(results)} photos)")
