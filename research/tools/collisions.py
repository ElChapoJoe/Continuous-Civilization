"""Find primary-key collisions if later-age 'current-only' data is loaded into an Antiquity game.
Read-only: parses the installed game's modinfo + XML files."""
import os, re, sys, collections
import xml.etree.ElementTree as ET

ROOT = sys.argv[1]  # .../Base/modules
TARGET_AGES = sys.argv[2].split(",")  # e.g. AGE_EXPLORATION,AGE_MODERN
CHRONO = {"AGE_ANTIQUITY": 0, "AGE_EXPLORATION": 1, "AGE_MODERN": 2}
CURRENT = "AGE_ANTIQUITY"

def strip(tag): return tag.split("}")[-1]

def criteria_met(crit_el, age):
    res = []
    for c in crit_el:
        t, v = strip(c.tag), (c.text or "").strip()
        inv = c.get("inverse") == "1"
        if t == "AlwaysMet": r = True
        elif t == "AgeInUse": r = (v == age)
        elif t == "AgeAtOrBefore": r = CHRONO.get(v, 99) <= CHRONO[age]
        elif t == "AgeEverInUse": r = (v == age)
        elif t == "AgeWasUsed": r = False
        else: r = False  # ModInUse, Config*, etc: treat as not met
        res.append(r != inv)
    return any(res) if crit_el.get("any") == "true" else all(res)

def db_files(modinfo, age):
    tree = ET.parse(modinfo); m = tree.getroot(); base = os.path.dirname(modinfo)
    crits = {c.get("id"): c for c in m.iter() if strip(c.tag) == "Criteria"}
    out = []
    for ag in m.iter():
        if strip(ag.tag) != "ActionGroup" or ag.get("scope") != "game": continue
        c = crits.get(ag.get("criteria"))
        if c is None or not criteria_met(c, age): continue
        for act in ag.iter():
            if strip(act.tag) == "UpdateDatabase":
                for it in act:
                    p = (it.text or "").strip()
                    if p.endswith(".xml") and not p.startswith("{"):
                        out.append(os.path.join(base, p))
    return out

def keys(path):
    """Yield (table, keyattr, value) for Types rows and *Type-keyed rows."""
    try: root = ET.parse(path).getroot()
    except Exception: return
    if strip(root.tag) != "Database": return
    for table in root:
        tn = strip(table.tag)
        for row in table:
            if strip(row.tag) != "Row": continue
            a = row.attrib
            if tn == "Types" and "Type" in a: yield ("Types", "Type", a["Type"])

mods = [os.path.join(dp, f) for dp, _, fs in os.walk(ROOT) for f in fs if f.endswith(".modinfo")]
loaded = set();
for mi in mods:
    try: loaded.update(db_files(mi, CURRENT))
    except Exception as e: print("skip", mi, e, file=sys.stderr)

base_keys = collections.defaultdict(list)
for f in loaded:
    for k in keys(f): base_keys[k].append(os.path.relpath(f, ROOT))

for age in TARGET_AGES:
    extra = set()
    for mi in mods:
        try: extra.update(db_files(mi, age))
        except Exception: pass
    extra -= loaded
    print(f"\n=== {age}: {len(extra)} extra DB files would be needed ===")
    coll = collections.defaultdict(list)
    for f in sorted(extra):
        for k in keys(f):
            if k in base_keys: coll[k].append(os.path.relpath(f, ROOT))
    print(f"Types collisions with Antiquity-loaded data: {len(coll)}")
    for (t, ka, v), fs in sorted(coll.items()):
        print(f"  {v}: {fs[0]}  <->  {base_keys[(t,ka,v)][0]}")
    for f in sorted(extra): print("   file:", os.path.relpath(f, ROOT))
