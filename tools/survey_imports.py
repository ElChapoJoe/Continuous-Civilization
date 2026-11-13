"""Survey the Exploration-only files the continuous-civ mod does NOT import yet.

For each file loaded by age-exploration only while the Exploration Age is current, prints: tables it fills (row
counts), primary-key collisions with what an Antiquity game already loads, GameEffects modifier-id collisions,
and Age conditions (REQUIREMENT_GAME_AGE_TYPE_MATCH / REQUIREMENT_IS_AGE_COUNT). Read-only.

    python -I tools/survey_imports.py "<Civ7 install>/Base" [AGE_EXPLORATION|AGE_MODERN]
"""
import os, re, sys, collections
import xml.etree.ElementTree as ET

def find_civ7_base():
    """The game's Base folder: first argument, else CIV7_DIR, else the Steam libraries on this machine."""
    if len(sys.argv) > 1 and sys.argv[1]:
        return sys.argv[1]
    env = os.environ.get("CIV7_DIR")
    if env:
        return env if os.path.basename(os.path.normpath(env)) == "Base" else os.path.join(env, "Base")
    roots = []
    for steam in (os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), "Steam"),
                  os.path.expanduser("~/.steam/steam"), os.path.expanduser("~/Library/Application Support/Steam")):
        vdf = os.path.join(steam, "steamapps", "libraryfolders.vdf")
        if os.path.isfile(vdf):
            roots += [p.replace("\\\\", "\\") for p in re.findall(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8").read())]
        roots.append(steam)
    for root in roots:
        base = os.path.join(root, "steamapps", "common", "Sid Meier's Civilization VII", "Base")
        if os.path.isdir(base):
            return base
    sys.exit("Civilization VII not found: pass its Base folder as the first argument or set CIV7_DIR.")


HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.join(HERE, "..", "mod", "continuous-civ")
BASE = find_civ7_base()
TARGET = sys.argv[2] if len(sys.argv) > 2 else "AGE_EXPLORATION"
TARGET_MODULE = {"AGE_EXPLORATION": "age-exploration", "AGE_MODERN": "age-modern"}[TARGET]
MODULES = os.path.join(BASE, "modules")
SCHEMA = os.path.join(BASE, "Assets", "schema", "gameplay", "01_GameplaySchema.sql")
CHRONO = {"AGE_ANTIQUITY": 0, "AGE_EXPLORATION": 1, "AGE_MODERN": 2}

def strip(t): return t.split("}")[-1]

def crit_met(c, current):
    res = []
    for e in c:
        t, v, inv = strip(e.tag), (e.text or "").strip(), e.get("inverse") == "1"
        r = {"AlwaysMet": True, "AgeInUse": v == current, "AgeAtOrBefore": CHRONO.get(v, 99) <= CHRONO[current],
             "AgeEverInUse": v == current}.get(t, False)
        res.append(r != inv)
    return any(res) if c.get("any") == "true" else all(res)

def loaded_items(modinfo, action, current):
    m = ET.parse(modinfo).getroot(); base = os.path.dirname(modinfo)
    crits = {c.get("id"): c for c in m.iter() if strip(c.tag) == "Criteria"}
    out = []
    for ag in m.iter():
        if strip(ag.tag) != "ActionGroup" or ag.get("scope") != "game": continue
        c = crits.get(ag.get("criteria"))
        if c is None or not crit_met(c, current): continue
        for act in ag.iter():
            if strip(act.tag) == action:
                for it in act:
                    p = (it.text or "").strip()
                    if it.get("locale") not in (None, "en_US"): continue
                    if p.endswith(".xml") and not p.startswith("{"): out.append(os.path.normpath(os.path.join(base, p)))
    return out

def our_imports():
    m = ET.parse(os.path.join(MOD, "continuous-civ.modinfo")).getroot()
    out = set()
    for it in m.iter():
        p = (it.text or "").strip()
        mm = re.match(r"\{([^}]+)\}(.*)", p)
        if mm: out.add(os.path.normpath(os.path.join(MODULES, mm.group(1), mm.group(2))))
    return out

def parse(path):
    try: return ET.parse(path).getroot()
    except Exception: return None

schema = open(SCHEMA, encoding="utf-8", errors="replace").read()
pks = {}
for m in re.finditer(r"CREATE TABLE '([^']+)' \((.*?)\n\);", schema, re.S):
    pk = re.search(r'PRIMARY KEY\(([^)]*)\)', m.group(2))
    if pk: pks[m.group(1)] = [c.strip().strip('"') for c in pk.group(1).split(",")]

modinfos = [os.path.join(dp, f) for dp, _, fs in os.walk(MODULES) for f in fs if f.endswith(".modinfo")]
ant, exp = set(), set()   # exp = files loaded when TARGET is the current Age
for mi in modinfos:
    try:
        ant.update(loaded_items(mi, "UpdateDatabase", "AGE_ANTIQUITY"))
        exp.update(loaded_items(mi, "UpdateDatabase", TARGET))
    except Exception as e:
        print("skip", mi, e, file=sys.stderr)
candidates = sorted(f for f in exp - ant - our_imports() if os.sep + TARGET_MODULE + os.sep in f)

existing, have_mods = set(), set()
for f in ant:
    r = parse(f)
    if r is None: continue
    if strip(r.tag) == "Database":
        for t in r:
            tn = strip(t.tag)
            for row in t:
                a = dict(row.attrib); [a.__setitem__(strip(c.tag), (c.text or "").strip()) for c in row]
                if tn in pks and all(c in a for c in pks[tn]): existing.add((tn, tuple(a[c] for c in pks[tn])))
    elif strip(r.tag) == "GameEffects":
        have_mods.update(m.get("id") for m in r if strip(m.tag) == "Modifier")

for f in candidates:
    r = parse(f)
    rel = os.path.relpath(f, MODULES)
    if r is None: print(f"{rel}: unparsable"); continue
    tables, coll, mcoll, ages = collections.Counter(), 0, 0, collections.Counter()
    for e in r.iter():
        t = e.get("type") or e.get("RequirementType")
        if t in ("REQUIREMENT_GAME_AGE_TYPE_MATCH", "REQUIREMENT_IS_AGE_COUNT"): ages[t.replace("REQUIREMENT_", "")] += 1
    if strip(r.tag) == "Database":
        for t in r:
            tn = strip(t.tag)
            for row in t:
                tables[tn] += 1
                a = dict(row.attrib); [a.__setitem__(strip(c.tag), (c.text or "").strip()) for c in row]
                if tn in pks and all(c in a for c in pks[tn]) and (tn, tuple(a[c] for c in pks[tn])) in existing: coll += 1
    else:
        ids = [m.get("id") for m in r if strip(m.tag) == "Modifier"]
        tables["Modifiers(GameEffects)"] = len(ids)
        mcoll = sum(1 for i in ids if i in have_mods)
    top = ", ".join(f"{k}:{v}" for k, v in tables.most_common(5))
    print(f"{rel}\n   rows: {top}\n   pk-collisions: {coll}  modifier-collisions: {mcoll}  age-conditions: {dict(ages)}")
