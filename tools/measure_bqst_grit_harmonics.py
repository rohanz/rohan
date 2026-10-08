#!/usr/bin/env python3
"""Hybrid Grit's harmonic levels, measured from the BQST plugin itself.

The article's harmonic chart (`drawHarmonics` in src/lib/visuals/bqst-render.ts)
runs Cream and the original (Legacy) Grit live through the TypeScript port in
src/lib/visuals/bqst-sat.ts. Since BQST 1.2.0 the default Grit is Hybrid: 75%
Legacy + 25% a model fitted to LA500A captures, which is not ported. This
script renders the real VST3 instead and writes the table the chart
interpolates:

  src/data/bqst-grit-harmonics.json   (committed, like bqst-match.json)

It follows `toneHarmonicsDb` exactly: a 0.55-peak sine, the saturation core at
176.4 kHz with no oversampling filters (the TS port runs the core at 4x a
44.1 kHz session; here the session itself is 176.4 kHz with oversampling Off,
so harmonics up to 50 kHz stay measurable), EQ flat, Mix 100%, Vintage off,
Autogain off, harmonics 2-10 in dB relative to the fundamental. Each point is
one process() call (settling time + steady tone, so pedalboard's latency
compensation stays inside the call); the settling part is discarded and a
Hann-windowed DFT runs over a whole number of cycles of a tone nudged onto an
exact bin.

  uv run --no-project --with pedalboard --with numpy \
      tools/measure_bqst_grit_harmonics.py path/to/BQST.vst3 [--validate]

--validate measures Cream and Legacy Grit the same way and compares them with
the TS port (bundled with the repo's esbuild and run in node), to check the
method before trusting the Hybrid table.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from pedalboard import load_plugin

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/data/bqst-grit-harmonics.json"

FS = 176400          # = SAT_RATE in bqst-sat.ts
AMPLITUDE = 0.55     # = TONE_AMPLITUDE
HARMONICS = list(range(2, 11))
SETTLE_S = 1.0       # Captured's 1 Hz output DC blocker needs longer than the TS port's 0.15 s
WINDOW_S = 0.25
FLOOR_DB = -90.0     # below the chart's -84 dB floor; also stands in for -inf (drive 0 is an exact bypass)

# Drive: 0.5 dB steps, finer near 0 (levels in dB move fastest there) and every
# 0.1 dB (the knob's keyboard step) over 5-9 dB, where Legacy's curve starts to
# bite and the 5th/7th/9th swing through sharp nulls within a few tenths of a dB.
DRIVES = sorted({0, 0.1, 0.2, 0.3, 0.5, 0.75}
                | {round(0.5 * i, 1) for i in range(2, 37)}
                | {round(5 + 0.1 * i, 1) for i in range(41)})
# Test tone: the chart's 40 Hz-5 kHz slider, every third of an octave, plus 5 kHz.
TONES = [round(40 * 2 ** (i / 3), 2) for i in range(21)] + [5000.0]


def load(path):
    p = load_plugin(path)
    p.eq_in = False   # really eqBypass
    p.sat_in = False  # really satBypass
    p.bypass = False
    p.realtime_os = "Off"
    p.render_os = "Off"
    p.autogain = False
    p.vintage = False
    p.input = 0.0
    p.eq_link = True
    p.sat_link = True
    p.sat_mode = "L/R"
    p.eq_mode = "L/R"
    for side in ("l_m", "r_s"):
        setattr(p, f"{side}_lf", 0.0)
        setattr(p, f"{side}_hf", 0.0)
        setattr(p, f"{side}_mix", 100.0)
        setattr(p, f"{side}_output", 0.0)
    return p


def harmonics_db(p, sat_type, model, drive, tone_hz):
    p.l_m_type = sat_type
    p.r_s_type = sat_type
    p.grit_model = model
    p.l_m_drive = float(drive)
    p.r_s_drive = float(drive)
    # Nudge the tone onto an exact bin of the analysis window (well under 1%).
    cycles = max(8, round(tone_hz * WINDOW_S))
    n = round(cycles * FS / tone_hz)
    settle = round(SETTLE_S * FS)
    t = np.arange(settle + n)
    x = (AMPLITUDE * np.sin(2 * np.pi * cycles * t / n)).astype(np.float32)
    y = p.process(np.stack([x, x]), FS, reset=True)[0, settle:].astype(np.float64)
    spectrum = np.fft.rfft(y * np.hanning(n + 1)[:n])  # periodic Hann
    mags = np.abs(spectrum[[k * cycles for k in [1] + HARMONICS]])
    return [max(FLOOR_DB, 20 * np.log10(m / mags[0])) if m > 0 else FLOOR_DB for m in mags[1:]]


def ts_reference(points):
    """toneHarmonicsDb from the TS port, for the given (type, drive, tone) points."""
    entry = ROOT / "src/lib/visuals/bqst-sat.ts"
    script = (
        f"import {{ toneHarmonicsDb }} from {json.dumps(str(entry))};\n"
        f"const pts = {json.dumps(points)};\n"
        f"console.log(JSON.stringify(pts.map(([t, d, f]) => toneHarmonicsDb(t, d, f, {HARMONICS}))));\n"
    )
    bundle = subprocess.run(
        [str(ROOT / "node_modules/.bin/esbuild"), "--bundle", "--format=esm", "--platform=node", "--loader=ts"],
        input=script, capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout
    out = subprocess.run(["node", "--input-type=module"], input=bundle, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def validate(p):
    points = [(d, f) for d in (1, 3, 6, 9, 12, 15, 18) for f in (40, 100, 315, 1000, 3000, 5000)]
    for ts_type, sat_type, model in (("cream", "Cream", "Hybrid"), ("grit", "Grit", "Legacy")):
        ref = ts_reference([(ts_type, d, f) for d, f in points])
        worst = {-60: 0.0, -84: 0.0}
        print(f"\n{sat_type} ({model}) plugin vs TS port, max |dB diff| over harmonics above -60 / -84 dB:")
        for (d, f), r in zip(points, ref):
            m = harmonics_db(p, sat_type, model, d, f)
            row = {}
            for floor in worst:
                errs = [abs(a - b) for a, b in zip(m, r) if max(a, b) > floor]
                row[floor] = max(errs) if errs else 0.0
                worst[floor] = max(worst[floor], row[floor])
            print(f"  drive {d:4.1f} dB  tone {f:6.0f} Hz  {row[-60]:6.3f} / {row[-84]:6.3f} dB"
                  f"   (H3 plugin {m[1]:7.2f}, TS {r[1]:7.2f})")
        print(f"  worst: {worst[-60]:.3f} dB above -60 dB, {worst[-84]:.3f} dB above -84 dB")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("usage: measure_bqst_grit_harmonics.py path/to/BQST.vst3 [--validate]")
    path = args[0]
    p = load(path)
    if "--validate" in sys.argv:
        validate(p)
        return
    # Whole tenths of a dB keep the file small; the chart is 340 px for 84 dB.
    table = [[[round(10 * v) for v in harmonics_db(p, "Grit", "Hybrid", d, f)] for f in TONES] for d in DRIVES]
    data = {
        "source": f"BQST {p.version} universal VST3 (github.com/rohanz/bqst), rendered with pedalboard by tools/measure_bqst_grit_harmonics.py",
        "settings": "Grit, Grit Model Hybrid (75% Legacy + 25% Captured LA500A path), EQ flat, Mix 100%, Vintage off, Autogain off, input 0 dB, oversampling Off at a 176.4 kHz session (the TS port's core rate)",
        "notes": "levels[drive][tone][harmonic] in tenths of a dB: harmonics 2-10 of a 0.55-peak sine relative to the fundamental, Hann-windowed DFT over a whole number of cycles after 1 s of settling. Clamped at -90 dB (-900), below the chart's -84 dB floor; drive 0 is an exact bypass. Validated with --validate: Cream and Legacy Grit measured this way match the TS port.",
        "rate": FS,
        "amplitude": AMPLITUDE,
        "harmonics": HARMONICS,
        "driveDb": DRIVES,
        "toneHz": TONES,
        "levels": table,
    }
    OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
