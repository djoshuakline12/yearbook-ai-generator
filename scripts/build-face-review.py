#!/usr/bin/env python3
"""Build the face-caption review page from _review/face_proposals.json.

Shows each photo with numbered face boxes and machine-proposed names
(green = confident, orange = low confidence, red = no match). The human
toggles/edits/approves; Export downloads face_captions_approved.csv in
captions_confirmed.csv format. Names autocomplete from the RenWeb portrait
DataFile.csv. Detection/matching only proposes — every printed name is
human-verified here.

Usage: python3 scripts/build-face-review.py
"""
import csv
import html
import json
import os

PACK = os.path.expanduser("~/Downloads/yearbook_import_pack")
RENWEB = os.path.expanduser(
    "~/Downloads/F262 - DELMARVA CHRISTIAN HIGH SCHOOL 4566 RenWeb 2025-10-24/DataFile.csv")

data = json.load(open(os.path.join(PACK, "_review", "face_proposals.json")))

# Existing captions (manifest first, confirmed overrides) keyed by basename;
# photos marked action=remove never print, so they leave the review too.
existing, removed = {}, set()
for fn in ("final_manifest.csv", "captions_confirmed.csv"):
    p = os.path.join(PACK, fn)
    if not os.path.exists(p):
        continue
    with open(p) as f:
        for row in csv.DictReader(f):
            fp = row.get("final_path", "")
            base = os.path.splitext(os.path.basename(fp))[0]
            if (row.get("action") or "").strip() == "remove":
                removed.add(base)
                existing.pop(base, None)
                continue
            cap = row.get("caption", "").strip()
            if cap and not cap.lower().startswith(("http://", "https://")):
                existing[base] = cap

names = []
if os.path.exists(RENWEB):
    with open(RENWEB, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            n = f'{row["First Name"].strip()} {row["Last Name"].strip()}'
            g = row["Grade"].strip()
            names.append(f'{n} ({g})' if g else n)
names = sorted(set(names))

cards = []
skipped_removed = 0
for ph in data:
    rel_src = "../" + ph["folder"] + "/" + ph["rel"].replace("\\", "/")
    final_path = ph["folder"] + "/" + ph["rel"].replace("\\", "/")
    base = os.path.splitext(os.path.basename(ph["rel"]))[0]
    if base in removed:
        skipped_removed += 1
        continue
    prior = existing.get(base, "")
    boxes, tags = [], []
    for j, f in enumerate(ph["faces"]):
        x1, y1, x2, y2 = f["box"]
        cls = "hi" if f["conf"] == "high" else ("lo" if f["conf"] == "low" else "un")
        start = "on" if f["conf"] == "high" else "off"
        label = f'{f["name"]} ({f["grade"]})' if f["name"] else ""
        boxes.append(
            f'<div class="fbox {cls} {start}" data-face="{j}" style="left:{x1/ph["width"]*100:.2f}%;top:{y1/ph["height"]*100:.2f}%;'
            f'width:{(x2-x1)/ph["width"]*100:.2f}%;height:{(y2-y1)/ph["height"]*100:.2f}%"><span>{j+1}</span></div>')
        tags.append(
            f'<button type="button" class="tag {cls} {start}" data-face="{j}" data-name="{html.escape(label)}">'
            f'<b>{j+1}</b> {html.escape(label) if label else "unknown"}<em>{f["sim"]:.2f}</em><i></i></button>')
    cards.append(f'''
<div class="card" data-path="{html.escape(final_path)}">
  <h3>{html.escape(ph["folder"])} <small>{html.escape(ph["rel"])}</small></h3>
  <div class="imgwrap"><img src="{html.escape(rel_src)}" loading="lazy">{''.join(boxes)}</div>
  <div class="tags">{''.join(tags) if tags else '<span class="notags">no faces found</span>'}</div>
  {'<div class="prior">already captioned — edit only if you want to change it</div>' if prior else ''}
  <textarea class="cap" rows="2" placeholder="Caption… (leave blank for no caption)"{' data-prior="1"' if prior else ''}>{html.escape(prior)}</textarea>
  <label class="ok"><input type="checkbox" class="approve"> caption checked &amp; correct</label>
</div>''')

page = f'''<!DOCTYPE html><html><head><meta charset="utf-8"><title>Face caption review</title>
<style>
 body {{ font-family: -apple-system, sans-serif; margin: 20px; background: #f5f4f8; }}
 h1 {{ font-size: 20px; }} .hint {{ color: #555; margin-bottom: 16px; max-width: 720px; }}
 .card {{ background: white; border-radius: 8px; padding: 14px; margin-bottom: 22px; box-shadow: 0 1px 4px rgba(0,0,0,.12); max-width: 700px; }}
 .card h3 {{ margin: 0 0 8px; font-size: 13px; }} .card h3 small {{ color: #888; font-weight: 400; }}
 .imgwrap {{ position: relative; display: inline-block; max-width: 620px; }}
 .imgwrap img {{ max-width: 100%; height: auto; display: block; border-radius: 4px; }}
 .fbox {{ position: absolute; border: 2px solid; border-radius: 3px; cursor: pointer; opacity: .45; }}
 .fbox.on {{ opacity: 1; }}
 .fbox span {{ position: absolute; top: -19px; left: -2px; font-size: 11px; font-weight: 700; color: white; padding: 0 5px; border-radius: 3px; }}
 .fbox.hi {{ border-color: #563D82; }} .fbox.hi span {{ background: #563D82; }}
 .fbox.lo {{ border-color: #e08700; border-style: dashed; }} .fbox.lo span {{ background: #e08700; }}
 .fbox.un {{ border-color: #b33; border-style: dotted; }} .fbox.un span {{ background: #b33; }}
 .fbox.on.hi, .fbox.on.lo {{ border-color: #1a8a3c; }} .fbox.on.hi span, .fbox.on.lo span {{ background: #1a8a3c; }}
 .tags {{ margin: 8px 0; }}
 .tag {{ display: inline-flex; align-items: center; gap: 5px; font-size: 13px; border: 1px solid #ccc; background: #f3f0f8; border-radius: 16px; padding: 3px 10px; margin: 2px 4px 2px 0; cursor: pointer; }}
 .tag em {{ color: #999; font-style: normal; font-size: 11px; }}
 .tag i {{ font-style: normal; font-size: 12px; }}
 .tag.on {{ background: #e2f4e8; border-color: #1a8a3c; }} .tag.on i::before {{ content: "✓ in caption"; color: #1a8a3c; font-weight: 600; }}
 .tag:not(.on) {{ opacity: .75; }} .tag:not(.on) i::before {{ content: "✗ out"; color: #999; }}
 .notags {{ font-size: 13px; color: #999; }}
 .prior {{ font-size: 12px; color: #1a8a3c; font-weight: 600; margin-bottom: 3px; }}
 .cap {{ width: 100%; font-size: 14px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }}
 .ok {{ font-size: 13px; color: #333; display: block; margin-top: 6px; }}
 #export {{ position: fixed; bottom: 20px; right: 20px; background: #563D82; color: white; border: 0; padding: 12px 22px; font-size: 15px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); }}
 #count {{ position: fixed; bottom: 26px; right: 190px; font-size: 13px; color: #555; background: #f5f4f8; padding: 2px 6px; }}
 #ac {{ display: none; position: absolute; z-index: 99; background: white; border: 1px solid #aaa; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.2); max-height: 220px; overflow-y: auto; min-width: 240px; }}
 .aci {{ padding: 6px 12px; font-size: 14px; cursor: pointer; }}
</style></head><body>
<h1>Face caption review — {len(cards)} photos</h1>
<p class="hint"><b>Click a name pill (or its box on the photo) to toggle it ✓ into / ✗ out of the caption.</b>
Green = in the caption. Confident matches start ✓ in; orange low-confidence ones start ✗ out — turn them on if they're right.
Type in the caption box for autocomplete on every roster name. Tick "caption checked" and Export when done.</p>
{''.join(cards)}
<span id="count"></span><button id="export">Export approved CSV</button>
<div id="ac"></div>
<script>
function rebuild(card) {{
  if (card.dataset.manual === '1') return;
  const names = [...card.querySelectorAll('.tag.on')].map(t => t.dataset.name).filter(Boolean);
  card.querySelector('.cap').value = names.join(', ');
}}
document.querySelectorAll('.card').forEach(card => {{
  if (card.querySelector('.cap').dataset.prior === '1') card.dataset.manual = '1';
  rebuild(card);
  card.querySelectorAll('.tag, .fbox').forEach(el => el.addEventListener('click', () => {{
    const j = el.dataset.face;
    card.querySelectorAll(`[data-face="${{j}}"]`).forEach(x => x.classList.toggle('on'));
    rebuild(card);
  }}));
  card.querySelector('.cap').addEventListener('input', () => {{ card.dataset.manual = '1'; }});
}});
function update() {{
  document.getElementById('count').textContent = document.querySelectorAll('.approve:checked').length + ' approved';
}}
document.addEventListener('change', update); update();
document.getElementById('export').onclick = () => {{
  const rows = [['final_path','caption','action']];
  document.querySelectorAll('.card').forEach(c => {{
    if (!c.querySelector('.approve').checked) return;
    rows.push([c.dataset.path, c.querySelector('.cap').value.trim(), '']);
  }});
  const csv = rows.map(r => r.map(v => '"' + v.replace(/"/g,'""') + '"').join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {{type:'text/csv'}}));
  a.download = 'face_captions_approved.csv';
  a.click();
}};
// name autocomplete
const NAMES = {json.dumps(names)};
const ac = document.getElementById('ac');
let acItems = [], acSel = -1, acTarget = null;
function fragmentOf(ta) {{
  const upto = ta.value.slice(0, ta.selectionStart);
  const m = upto.match(/([^,]*)$/);
  return m ? m[1].replace(/^\\s+/, '') : '';
}}
function showAC(ta) {{
  const frag = fragmentOf(ta);
  if (frag.trim().length < 2) {{ hideAC(); return; }}
  const q = frag.trim().toLowerCase();
  acItems = NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 8);
  if (!acItems.length) {{ hideAC(); return; }}
  acTarget = ta; acSel = -1;
  ac.innerHTML = acItems.map((n, i) => `<div class="aci" data-i="${{i}}">${{n}}</div>`).join('');
  const r = ta.getBoundingClientRect();
  ac.style.left = (r.left + window.scrollX) + 'px';
  ac.style.top = (r.bottom + window.scrollY + 2) + 'px';
  ac.style.display = 'block';
}}
function hideAC() {{ ac.style.display = 'none'; acSel = -1; acTarget = null; }}
function pick(i) {{
  if (!acTarget || i < 0 || i >= acItems.length) return;
  const ta = acTarget;
  const upto = ta.value.slice(0, ta.selectionStart);
  const after = ta.value.slice(ta.selectionStart);
  const cut = upto.replace(/[^,]*$/, '');
  const sep = cut.trim().length ? ' ' : '';
  const ins = cut + sep + acItems[i];
  ta.value = ins + after;
  ta.selectionStart = ta.selectionEnd = ins.length;
  ta.closest('.card').dataset.manual = '1';
  hideAC(); ta.focus();
}}
ac.addEventListener('mousedown', e => {{
  const d = e.target.closest('.aci'); if (d) {{ e.preventDefault(); pick(+d.dataset.i); }}
}});
document.querySelectorAll('.cap').forEach(ta => {{
  ta.addEventListener('input', () => showAC(ta));
  ta.addEventListener('blur', () => setTimeout(hideAC, 150));
  ta.addEventListener('keydown', e => {{
    if (ac.style.display === 'none') return;
    const rows = ac.querySelectorAll('.aci');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {{
      e.preventDefault();
      acSel = e.key === 'ArrowDown' ? Math.min(acSel + 1, rows.length - 1) : Math.max(acSel - 1, 0);
      rows.forEach((r, i) => r.style.background = i === acSel ? '#efeaf6' : '');
    }} else if (e.key === 'Enter' && acSel >= 0) {{ e.preventDefault(); pick(acSel); }}
    else if (e.key === 'Tab' && rows.length) {{ e.preventDefault(); pick(acSel >= 0 ? acSel : 0); }}
    else if (e.key === 'Escape') hideAC();
  }});
}});
</script></body></html>'''

out = os.path.join(PACK, "_review", "face_review.html")
open(out, "w").write(page)
print(f"wrote {out} ({len(cards)} photos, {skipped_removed} removed excluded)")
