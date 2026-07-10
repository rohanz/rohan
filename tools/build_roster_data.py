"""Build the roster exhibit data for the analyst article.

For each model generation, take its real GE memo from data/eval and segment it
into text / verified-number / violating-number spans, mirroring the gate's own
tokenisation and exclusion rules (quantlab/memo.py:verify_numbers) so the
highlighting can't disagree with the gate.
"""
import json, re, sys

QL = "/Users/rohan/Documents/progwork/quantlab"
OUT = "/Users/rohan/Documents/progwork/www/rohan-website-redesign/assets/js/quantlab-visual-data.json"
TICKER = "GE"
CURRENT_YEAR = 2026

MODELS = [
    dict(id="base",  dir="qwen3_8b",                     name="base 8B (untuned)", pass_="40%", acc="96%",
         desc="Qwen3 8B exactly as downloaded, no training. Timid but honest: it cites few numbers, so few can be wrong."),
    dict(id="v1",    dir="quantlab-analyst",             name="v1", pass_="10%", acc="n/a",
         desc="388 teacher memos, 2 epochs. Memorised its training data and wrote other companies' numbers into new memos."),
    dict(id="v2.1",  dir="quantlab-analyst-v2.1-q8",     name="v2.1", pass_="36%", acc="95.4%",
         desc="1,237 memos, 2 epochs, time-sliced splits. The honest 8B writer, and the 95.4% wall."),
    dict(id="v3",    dir="quantlab-analyst-v3-q8",       name="v3", pass_="26%", acc="94.7%",
         desc="v2.1 + DPO on pass/fail pairs. Found the loophole: learned to cite less instead of better."),
    dict(id="v4",    dir="quantlab-analyst-v4-q8",       name="v4", pass_="30%", acc="94.2%",
         desc="v2.1 + minimal-pair DPO, wrong digits corrected. Loophole closed; precision unmoved."),
    dict(id="v5",    dir="quantlab-analyst-v5-q8",       name="v5 (the fixer)", pass_="26%", acc="94.5%",
         desc="v2.1 retrained to repair gate-flagged memos. Kept as the repair specialist; shown here writing."),
    dict(id="14b",   dir="quantlab-analyst-14b-e3-q8",   name="14B", pass_="56%", acc="97.4%",
         desc="The v2.1 recipe on a model twice the size. Capacity confirmed: same data, cleaner transcription."),
    dict(id="14bmax",dir="quantlab-analyst-14b-max-q8",  name="14b-max", pass_="82%", acc="99.1%",
         desc="The 14B with the teacher corpus doubled to about 2,000 memos. The single biggest jump of the project."),
    dict(id="v6",    dir="quantlab-analyst-v6-q8",       name="v6 (final writer)", pass_="84%", acc="99.6%",
         desc="14b-max + quality DPO. Failed to move the judge, nudged the gate numbers up. The production drafter."),
]

EXCLUDE = [
    r"\b\d{4}-\d{2}-\d{2}\b",
    r"\b(?:S&P|Fortune|Russell|NASDAQ)[- ]?\d+\b",
    r"\b\d+[- ](?:day|week|month|year|quarter)s?\b",
    r"\b7[3-8]7(?:\s+MAX|\s+Dreamliner)?\b",
]
NUM_RE = re.compile(r"(?<![\w%-])-?\d+(?:,\d{3})*(?:\.\d+)?")

def strip_md(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)   # bold markers
    text = re.sub(r"^#{1,4} ?", "", text, flags=re.M)  # heading markers
    return text

def segment(memo, violations):
    skip = [False] * len(memo)
    for pat in EXCLUDE:
        for m in re.finditer(pat, memo):
            for i in range(m.start(), m.end()):
                skip[i] = True
    vio = set(violations)
    segs, last = [], 0
    for m in NUM_RE.finditer(memo):
        tok, (s, e) = m.group(0), m.span()
        if any(skip[s:e]):
            continue
        num = float(tok.replace(",", ""))
        if 1990 <= num <= CURRENT_YEAR + 1 and "." not in tok:
            continue  # fiscal years, same as the gate
        if re.fullmatch(r"[FMP]?\d+", tok) and num < 200:
            continue  # evidence ids / small counts, same as the gate
        cls = "bad" if tok in vio else "ok"
        if s > last:
            segs.append({"t": "x", "s": memo[last:s]})
        segs.append({"t": cls, "s": tok})
        last = e
    segs.append({"t": "x", "s": memo[last:]})
    return segs

roster = []
for m in MODELS:
    d = json.load(open(f"{QL}/data/eval/{m['dir']}/{TICKER}.json"))
    segs = segment(strip_md(d["memo"]), d["gate_violations"])
    n_bad = sum(1 for x in segs if x["t"] == "bad")
    n_ok = sum(1 for x in segs if x["t"] == "ok")
    roster.append(dict(
        id=m["id"], name=m["name"], desc=m["desc"],
        passRate=m["pass_"], acc=m["acc"],
        memoCites=d["n_citations"], memoBad=n_bad, memoOk=n_ok,
        memoPassed=d["gate_passed"], segments=segs,
    ))
    print(f"{m['id']:8} ok={n_ok:3} bad={n_bad:2} cites={d['n_citations']} passed={d['gate_passed']}")

data = json.load(open(OUT))
data["roster"] = dict(ticker=TICKER, teacherPass="93%", teacherAcc="99.8%", models=roster)
json.dump(data, open(OUT, "w"), ensure_ascii=False)
print("written", OUT)
