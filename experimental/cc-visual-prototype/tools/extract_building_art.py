"""Extract which model each building art bin uses for each building culture (read-only).

Reads the installed game's art packages (Base/Platforms/Windows/BLPs/StandardAsset.*.blp) and
writes ui/cc-building-art.js (globalThis.CCBuildingArt): building type -> art bins, and for each
bin the [culture, Age, model] choices for completed buildings, in the order the engine tests
them. Only asset names and condition keys are written, which the overlay needs to ask the game
to draw its own models; no art is copied.

Format notes (found by inspection, 2026-11-13):
- A bin entry is a 32-byte record: f32 weight (1.0), u32 kind, u32 FNV-1a hash of the model
  name, u32 0, u16 model index, 6 bytes 0, u16 condition index, 6 bytes 0.
- A bin's records are contiguous, followed by its model names, its condition strings and then
  its BIN_ name. A condition used for the first time gets the next condition index and its
  string follows the records in index order; a reused condition points back to an earlier one.

Usage: python -I extract_building_art.py [Civ VII Base folder]
"""
import bisect
import glob
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "ui", "cc-building-art.js")


def find_base():
    if len(sys.argv) > 1:
        return sys.argv[1]
    env = os.environ.get("CIV7_DIR")
    if env:
        return env if os.path.basename(os.path.normpath(env)) == "Base" else os.path.join(env, "Base")
    roots = []
    steam = os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), "Steam")
    vdf = os.path.join(steam, "steamapps", "libraryfolders.vdf")
    if os.path.isfile(vdf):
        roots += [p.replace("\\\\", "\\") for p in re.findall(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8").read())]
    roots.append(steam)
    for root in roots:
        base = os.path.join(root, "steamapps", "common", "Sid Meier's Civilization VII", "Base")
        if os.path.isdir(base):
            return base
    sys.exit("Civilization VII not found: pass its Base folder or set CIV7_DIR.")


def fnv1a(s):
    h = 0x811C9DC5
    for c in s.encode():
        h = ((h ^ c) * 0x01000193) & 0xFFFFFFFF
    return h


RECORD = re.compile(rb"\x00\x00\x80\x3f(.{4})(.{4})\x00\x00\x00\x00(.{2})\x00{6}(.{2})\x00{6}", re.S)
STRING = re.compile(rb"[A-Za-z0-9_\[\]:. ()]{6,}(?=\x00)")
CULTURE = re.compile(r"\[BUILDING_CULTURE:BUILDING_CULTURE_([A-Z_]+)\]")
BUILDING = re.compile(r"^\[BUILDING:([A-Z0-9_]+)\]$")
AGE = re.compile(r"\[AGE:AGE_([A-Z]+)\]")


def parse(path, bins, dispatch, names):
    data = open(path, "rb").read()
    strings = [(m.start(), m.group().decode()) for m in STRING.finditer(data)]
    for _, s in strings:
        names.setdefault(fnv1a(s), s)
    records = [(m.start(), struct.unpack("<I", m.group(2))[0], struct.unpack("<H", m.group(4))[0])
               for m in RECORD.finditer(data)]
    # A bin is a run of contiguous records, then its model names and condition strings, then
    # its BIN_ name (the first BIN_ string after the last condition). Each record names its
    # condition by index. A condition used for the first time gets the next index and its
    # string follows the run, in index order; reused conditions point back to earlier ones.
    runs = []
    for o, h, c in records:
        if runs and o - runs[-1][1] <= 32:
            runs[-1][1] = o
            runs[-1][2].append((h, c))
        else:
            runs.append([o, o, [(h, c)]])
    starts = [o for o, _ in strings]
    known, top = {}, -1
    for i, (a, b, recs) in enumerate(runs):
        end = runs[i + 1][0] if i + 1 < len(runs) else len(data)
        j = bisect.bisect_right(starts, b + 32)
        region = []
        while j < len(strings) and strings[j][0] < end:
            region.append(strings[j][1])
            j += 1
        conds = [s for s in region if s.startswith("[")]
        new = sorted({c for _, c in recs if c > top})
        for c, s in zip(new, conds):
            known[c] = s
        if new:
            top = max(top, new[-1])
        last = max((k for k, s in enumerate(region) if s.startswith("[")), default=-1)
        name = next((s for s in region[last + 1:] if s.startswith("BIN_")), None)
        if not name:
            continue
        cult = []
        for cond, model in ((known.get(c), names.get(h)) for h, c in recs):
            if not cond:
                continue
            bm = BUILDING.match(cond)
            if bm and model:
                dispatch.setdefault(bm.group(1), [])
                if model not in dispatch[bm.group(1)]:
                    dispatch[bm.group(1)].append(model)
                continue
            if not model or "CONSTRUCTION" in cond or "PILLAGED" in cond:
                continue
            c = CULTURE.search(cond)
            a = AGE.search(cond)
            # Only completed-building conditions made of culture, Age and state terms.
            rest = re.sub(r"\[(BUILDING_CULTURE|AGE|CONSTRUCTIBLE_STATE):[A-Z_]+\]|\band\b|\s", "", cond)
            if rest:
                continue
            cult.append([c.group(1) if c else "*", a.group(1) if a else "*", model])
        if cult and name not in bins:
            bins[name] = cult


def main():
    base = find_base()
    files = sorted(glob.glob(os.path.join(base, "Platforms", "Windows", "BLPs", "StandardAsset.*.blp")))
    names = {}
    for f in files:  # names first: a record may point at a model named in another package
        for m in STRING.finditer(open(f, "rb").read()):
            s = m.group().decode()
            names.setdefault(fnv1a(s), s)
    bins, dispatch = {}, {}
    for f in files:
        parse(f, bins, dispatch, names)
    out = "// Generated by tools/extract_building_art.py from the installed game. Asset names only.\n"
    out += "// bins: building type -> [art bins]. art: bin -> [[culture or *, Age or *, model], ...] in test order.\n"
    out += "globalThis.CCBuildingArt = " + json.dumps({"bins": dispatch, "art": bins}, separators=(",", ":"), sort_keys=True) + ";\n"
    open(OUT, "w", encoding="utf-8", newline="\n").write(out)
    print(f"{len(dispatch)} buildings, {len(bins)} bins -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
