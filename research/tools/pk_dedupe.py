"""Generate DELETE statements removing Antiquity-loaded rows whose PRIMARY KEY collides with
rows in the given later-age files. Read-only on game files; prints SQL to stdout."""
import os, re, sys, collections
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from collisions import db_files, strip  # reuse modinfo criteria evaluation

MODULES, SCHEMA = sys.argv[1], sys.argv[2]
INCOMING = sys.argv[3:]  # module-relative paths like age-exploration/data/units.xml

# --- PKs from schema
schema = open(SCHEMA, encoding="utf-8", errors="replace").read()
pks = {}
for m in re.finditer(r"CREATE TABLE '([^']+)' \((.*?)\n\);", schema, re.S):
    pk = re.search(r'PRIMARY KEY\(([^)]*)\)', m.group(2))
    if pk: pks[m.group(1)] = [c.strip().strip('"') for c in pk.group(1).split(",")]

def rows(path):
    try: root = ET.parse(path).getroot()
    except Exception: return
    if strip(root.tag) != "Database": return
    for table in root:
        tn = strip(table.tag)
        for row in table:
            if strip(row.tag) == "Row":
                a = dict(row.attrib)
                for ch in row:  # child-element column form
                    a[strip(ch.tag)] = (ch.text or "").strip()
                yield tn, a

mods = [os.path.join(dp, f) for dp, _, fs in os.walk(MODULES) for f in fs if f.endswith(".modinfo")]
loaded = set()
for mi in mods:
    try: loaded.update(db_files(mi, "AGE_ANTIQUITY"))
    except Exception: pass
existing = set()
for f in loaded:
    for tn, a in rows(f):
        if tn in pks and all(c in a for c in pks[tn]):
            existing.add((tn, tuple(a[c] for c in pks[tn])))

out = collections.OrderedDict()
for rel in INCOMING:
    for tn, a in rows(os.path.join(MODULES, rel)):
        if tn in pks and all(c in a for c in pks[tn]):
            key = (tn, tuple(a[c] for c in pks[tn]))
            if key in existing: out[key] = rel
missing_pk = set()
for (tn, vals), rel in out.items():
    cond = " AND ".join(f"{c} = '{v}'" for c, v in zip(pks[tn], vals))
    print(f"DELETE FROM {tn} WHERE {cond};  -- re-defined by {rel}")
print(f"-- {len(out)} collisions", file=sys.stderr)
