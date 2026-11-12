"""Generate the collision-handling SQL for the continuous-civ mod.

Reads (read-only) the installed Civilization VII modules plus our own .modinfo, finds every
{age-*} file we import, and writes:
  mod/continuous-civ/data/00-pre-dedupe.sql   DELETEs for gameplay rows whose PRIMARY KEY the
                                              imported files re-define
  mod/continuous-civ/text/00-pre-dedupe-text.sql  DELETEs for colliding localization tags
  mod/continuous-civ/data/06-restore-cascades.sql puts back rows those deletes cascaded into via foreign keys
                                                  (e.g. Antiquity city-states under a shared Affinities row)
  mod/continuous-civ/data/00-pre-park-ids.sql     ids of Antiquity GameEffects modifiers that imported files
                                                  re-define (parked and restored, not deleted)

Re-run after every game patch:  python -I tools/gen_dedupe.py "<Civ7 install>/Base"
"""
import os, re, sys, collections
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.join(HERE, "..", "mod", "continuous-civ")
BASE = sys.argv[1] if len(sys.argv) > 1 else r"G:\SteamLibrary\steamapps\common\Sid Meier's Civilization VII\Base"
MODULES = os.path.join(BASE, "modules")
SCHEMA = os.path.join(BASE, "Assets", "schema", "gameplay", "01_GameplaySchema.sql")
CHRONO = {"AGE_ANTIQUITY": 0, "AGE_EXPLORATION": 1, "AGE_MODERN": 2}
CURRENT = "AGE_ANTIQUITY"

def strip(t): return t.split("}")[-1]

def crit_met(c):
    res = []
    for e in c:
        t, v, inv = strip(e.tag), (e.text or "").strip(), e.get("inverse") == "1"
        r = {"AlwaysMet": True, "AgeInUse": v == CURRENT,
             "AgeAtOrBefore": CHRONO.get(v, 99) <= CHRONO[CURRENT],
             "AgeEverInUse": v == CURRENT}.get(t, False)
        res.append(r != inv)
    return any(res) if c.get("any") == "true" else all(res)

def loaded_items(modinfo, action):
    """Files a base module loads in an Antiquity game for the given action (UpdateDatabase/UpdateText)."""
    m = ET.parse(modinfo).getroot(); base = os.path.dirname(modinfo)
    crits = {c.get("id"): c for c in m.iter() if strip(c.tag) == "Criteria"}
    out = []
    for ag in m.iter():
        if strip(ag.tag) != "ActionGroup" or ag.get("scope") != "game": continue
        c = crits.get(ag.get("criteria"))
        if c is None or not crit_met(c): continue
        for act in ag.iter():
            if strip(act.tag) == action:
                for it in act:
                    p = (it.text or "").strip()
                    if it.get("locale") not in (None, "en_US"): continue
                    if p.endswith(".xml") and not p.startswith("{"):
                        out.append(os.path.join(base, p))
    return out

def our_imports(action):
    m = ET.parse(os.path.join(MOD, "continuous-civ.modinfo")).getroot()
    out = []
    for act in m.iter():
        if strip(act.tag) == action:
            for it in act:
                p = (it.text or "").strip()
                mm = re.match(r"\{([^}]+)\}(.*)", p)
                if mm and mm.group(1).startswith("age-"):
                    out.append(os.path.join(MODULES, mm.group(1), mm.group(2)))
    return out

def rows(path):
    try: root = ET.parse(path).getroot()
    except Exception: return
    if strip(root.tag) != "Database": return
    for table in root:
        tn = strip(table.tag)
        for row in table:
            if strip(row.tag) == "Row":
                a = dict(row.attrib)
                for ch in row: a[strip(ch.tag)] = (ch.text or "").strip()
                yield tn, a

def effect_ids(path):
    """Modifier ids defined by a <GameEffects> file."""
    try: root = ET.parse(path).getroot()
    except Exception: return
    if strip(root.tag) != "GameEffects": return
    for m in root:
        if strip(m.tag) == "Modifier" and m.get("id"): yield m.get("id")

def text_tags(path):
    try: root = ET.parse(path).getroot()
    except Exception: return
    for row in root.iter():
        if strip(row.tag) in ("Row", "Replace") and row.get("Tag"): yield row.get("Tag")

schema = open(SCHEMA, encoding="utf-8", errors="replace").read()
pks = {}
for m in re.finditer(r"CREATE TABLE '([^']+)' \((.*?)\n\);", schema, re.S):
    pk = re.search(r'PRIMARY KEY\(([^)]*)\)', m.group(2))
    if pk: pks[m.group(1)] = [c.strip().strip('"') for c in pk.group(1).split(",")]

modinfos = [os.path.join(dp, f) for dp, _, fs in os.walk(MODULES) for f in fs if f.endswith(".modinfo")]
db_loaded, txt_loaded = set(), set()
for mi in modinfos:
    try:
        db_loaded.update(loaded_items(mi, "UpdateDatabase"))
        txt_loaded.update(loaded_items(mi, "UpdateText"))
    except Exception as e:
        print("skip", mi, e, file=sys.stderr)

# --- gameplay PK collisions (also between the imported files themselves, in load order)
existing = set()
for f in db_loaded:
    for tn, a in rows(f):
        if tn in pks and all(c in a for c in pks[tn]): existing.add((tn, tuple(a[c] for c in pks[tn])))
coll = collections.OrderedDict()
for f in our_imports("UpdateDatabase"):
    for tn, a in rows(f):
        if tn in pks and all(c in a for c in pks[tn]):
            k = (tn, tuple(a[c] for c in pks[tn]))
            if k in existing: coll[k] = os.path.relpath(f, MODULES)

def q(v): return "'" + v.replace("'", "''") + "'"

# --- foreign keys (child table -> parent table). Deleting a colliding row cascades into every row that
#     references it (e.g. deleting an Affinities row deletes every Independents row with that affinity), or
#     resets the reference (SET DEFAULT / SET NULL). Those rows are snapshotted before the deletes and put back
#     after the imports (data/06-restore-cascades.sql), except where the import re-defines them.
fks = collections.defaultdict(list)   # parent -> [(child, child_cols, parent_cols, action)]
for m in re.finditer(r"CREATE TABLE '([^']+)' \((.*?)\n\);", schema, re.S):
    child = m.group(1)
    for fk in re.finditer(r'FOREIGN KEY \(([^)]*)\) REFERENCES "([^"]+)"\(([^)]*)\) ON DELETE (CASCADE|SET DEFAULT|SET NULL)', m.group(2)):
        cc = [c.strip().strip('"') for c in fk.group(1).split(",")]
        pc = [c.strip().strip('"') for c in fk.group(3).split(",")]
        fks[fk.group(2)].append((child, cc, pc, fk.group(4)))

def casc_plan(roots, pfx="cc_casc_", skip=()):
    """BFS over FK edges from the deleted root tables. Returns ordered [(child, parent_snapshot, cc, pc, action)].
    Snapshot tables are named <pfx>root_<table> / <pfx><child>; `skip` child tables are not followed."""
    plan, seen, frontier = [], set(), [(t, f"{pfx}root_{t}") for t in roots]
    for _depth in range(4):
        nxt = []
        for parent, snap in frontier:
            for child, cc, pc, action in fks.get(parent, []):
                key = (child, parent, tuple(cc))
                if key in seen or child in skip: continue
                seen.add(key)
                plan.append((child, snap, cc, pc, action))
                if action == "CASCADE": nxt.append((child, f"{pfx}{child}"))
        frontier = nxt
    return plan

roots = sorted({tn for (tn, _vals) in coll})
plan = casc_plan(roots)
with open(os.path.join(MOD, "data", "00-pre-dedupe.sql"), "w", encoding="utf-8", newline="\n") as o:
    o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
    o.write("-- Removes Antiquity-loaded rows whose primary key is re-defined by an imported Exploration file.\n")
    o.write("-- 1) Snapshot the rows these deletes would cascade into (restored by 06-restore-cascades.sql).\n")
    for t in roots:
        o.write(f"DROP TABLE IF EXISTS cc_casc_root_{t};\nCREATE TABLE cc_casc_root_{t} AS SELECT * FROM {t} WHERE 0;\n")
    for (tn, vals), src in coll.items():
        cond = " AND ".join(f"{c} = {q(v)}" for c, v in zip(pks[tn], vals))
        o.write(f"INSERT INTO cc_casc_root_{tn} SELECT * FROM {tn} WHERE {cond};\n")
    made = set()
    for child, snap, cc, pc, action in plan:
        tbl = f"cc_casc_{child}" if action == "CASCADE" else f"cc_casc_set_{child}"
        if tbl not in made:
            o.write(f"DROP TABLE IF EXISTS {tbl};\nCREATE TABLE {tbl} AS SELECT * FROM {child} WHERE 0;\n")
            made.add(tbl)
        on = " AND ".join(f"c.{a} = p.{b}" for a, b in zip(cc, pc))
        o.write(f"INSERT INTO {tbl} SELECT c.* FROM {child} c WHERE EXISTS (SELECT 1 FROM {snap} p WHERE {on});\n")
    o.write("-- 2) Delete (child tables first; Types last).\n")
    for (tn, vals), src in sorted(coll.items(), key=lambda kv: kv[0][0] == "Types"):
        cond = " AND ".join(f"{c} = {q(v)}" for c, v in zip(pks[tn], vals))
        o.write(f"DELETE FROM {tn} WHERE {cond};  -- {src}\n")

with open(os.path.join(MOD, "data", "06-restore-cascades.sql"), "w", encoding="utf-8", newline="\n") as o:
    o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
    o.write("-- Puts back rows that 00-pre-dedupe.sql's deletes cascaded into, unless the import re-defined them\n")
    o.write("-- (INSERT OR IGNORE), and restores references that were reset by SET DEFAULT / SET NULL.\n")
    done = set()
    for child, snap, cc, pc, action in plan:
        tbl = f"cc_casc_{child}" if action == "CASCADE" else f"cc_casc_set_{child}"
        if tbl in done: continue
        done.add(tbl)
        verb = "INSERT OR IGNORE" if action == "CASCADE" else "INSERT OR REPLACE"
        o.write(f"{verb} INTO {child} SELECT * FROM {tbl};\n")
    for t in sorted(done) + [f"cc_casc_root_{t}" for t in roots]:
        o.write(f"DROP TABLE IF EXISTS {t};\n")

# --- GameEffects modifier-id collisions: these are parked (not deleted) by data/01-park-modifiers.sql and
#     put back by data/55-restore-parked-modifiers.sql, so Antiquity keeps its own version of each effect.
have_mods = set()
for f in db_loaded: have_mods.update(effect_ids(f) or ())
mcoll = collections.OrderedDict()
for f in our_imports("UpdateDatabase"):
    for mid in effect_ids(f) or ():
        if mid in have_mods: mcoll[mid] = os.path.relpath(f, MODULES)
with open(os.path.join(MOD, "data", "00-pre-park-ids.sql"), "w", encoding="utf-8", newline="\n") as o:
    o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
    o.write("-- Antiquity modifier ids that an imported Exploration GameEffects file re-defines.\n")
    o.write("DROP TABLE IF EXISTS cc_park_ids;\nCREATE TABLE cc_park_ids (ModifierId TEXT PRIMARY KEY);\n")
    for mid, src in mcoll.items():
        o.write(f"INSERT INTO cc_park_ids VALUES ({q(mid)});  -- {src}\n")

# --- text collisions
have = set()
for f in txt_loaded: have.update(text_tags(f))
# Resource text is imported only for the tooltips of resources new to Antiquity; where it re-defines an
# Antiquity resource tooltip, the Antiquity text is parked and put back by text/55-restore-parked-text.sql.
# Only LOC_ANT_* tags are parked: Antiquity also defines LOC_EXP_* tooltips, but only as "attainable in the
# next age" placeholders, which the Exploration text must replace.
PARK_TEXT = re.compile(r"^ResourcesText")
tpark = sorted({t for f in our_imports("UpdateText") if PARK_TEXT.match(os.path.basename(f))
                for t in text_tags(f) if t in have and t.startswith("LOC_ANT_")})
tcoll = sorted({t for f in our_imports("UpdateText") for t in text_tags(f) if t in have} - set(tpark))
with open(os.path.join(MOD, "text", "00-pre-dedupe-text.sql"), "w", encoding="utf-8", newline="\n") as o:
    o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
    o.write("DROP TABLE IF EXISTS cc_park_text;\n")
    o.write("CREATE TABLE cc_park_text AS SELECT * FROM LocalizedText WHERE Tag IN (\n  "
            + ",\n  ".join(q(t) for t in tpark or ["-"]) + ");\n")
    o.write("DELETE FROM LocalizedText WHERE Tag IN (SELECT Tag FROM cc_park_text);\n")
    if tcoll:
        o.write("DELETE FROM LocalizedText WHERE Tag IN (\n  " + ",\n  ".join(q(t) for t in tcoll) + ");\n")


# --- collisions BETWEEN our import groups (e.g. Modern re-defining a row Exploration's import already added).
#     Each later import ActionGroup gets data/09-dedupe-<group>.sql and text/09-dedupe-<group>-text.sql, listed
#     first in that group: they delete the earlier import's row so the later Age's version wins (as in vanilla,
#     where each Age's files replace the previous Age's). Modifier-id clashes between imports are not handled yet
#     and stop the generator.
def import_groups():
    m = ET.parse(os.path.join(MOD, "continuous-civ.modinfo")).getroot()
    out = []
    for ag in m.iter():
        if strip(ag.tag) != "ActionGroup": continue
        lo = next((int(e.text) for e in ag.iter() if strip(e.tag) == "LoadOrder"), 0)
        files = {"UpdateDatabase": [], "UpdateText": []}
        for act in ag.iter():
            if strip(act.tag) in files:
                for it in act:
                    mm = re.match(r"\{([^}]+)\}(.*)", (it.text or "").strip())
                    if mm and mm.group(1).startswith("age-"):
                        files[strip(act.tag)].append(os.path.join(MODULES, mm.group(1), mm.group(2)))
        if files["UpdateDatabase"] or files["UpdateText"]: out.append((lo, ag.get("id"), files))
    return sorted(out, key=lambda g: g[0])

def pk_keys(path):
    for tn, a in rows(path):
        if tn in pks and all(c in a for c in pks[tn]): yield (tn, tuple(a[c] for c in pks[tn]))

groups = import_groups()
earlier_keys, earlier_mods, earlier_tags = set(), set(), set()
inter_report = []
for gi, (_lo, gid, files) in enumerate(groups):
    gkeys = collections.OrderedDict(); gmods = set(); gtags = set()
    for f in files["UpdateDatabase"]:
        for k in pk_keys(f): gkeys.setdefault(k, os.path.relpath(f, MODULES))
        gmods.update(effect_ids(f) or ())
    for f in files["UpdateText"]: gtags.update(text_tags(f))
    if gi > 0:
        kc = [(k, src) for k, src in gkeys.items() if k in earlier_keys]
        mc = sorted(gmods & earlier_mods)
        tc = sorted(gtags & earlier_tags)
        # Rows these deletes cascade into (e.g. every city-state under a re-defined Affinities row, the links to a
        # re-defined modifier) are snapshotted first and put back by 09-restore-<group>.sql, the group's last item.
        # Definition tables of the deleted rows themselves are not put back (the later import defines its own).
        ipfx = "cc_ic_" + re.sub(r"\W", "_", gid) + "_"
        iroots = sorted({tn for (tn, _v), _s in kc} | ({"Modifiers"} if mc else set()))
        iplan = casc_plan(iroots, ipfx, skip={"ModifierArguments", "ModifierStrings", "RequirementArguments",
                                               "RequirementSetRequirements"})
        with open(os.path.join(MOD, "data", f"09-dedupe-{gid}.sql"), "w", encoding="utf-8", newline="\n") as o:
            o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
            o.write(f"-- Rows that {gid} re-defines after an earlier import group added them (later Age wins).\n")
            o.write("-- 1) Snapshot the rows these deletes would cascade into (restored by 09-restore-" + gid + ".sql).\n")
            for t in iroots:
                o.write(f"DROP TABLE IF EXISTS {ipfx}root_{t};\nCREATE TABLE {ipfx}root_{t} AS SELECT * FROM {t} WHERE 0;\n")
            for (tn, vals), src in kc:
                cond = " AND ".join(f"{c} = {q(v)}" for c, v in zip(pks[tn], vals))
                o.write(f"INSERT INTO {ipfx}root_{tn} SELECT * FROM {tn} WHERE {cond};\n")
            if mc:
                o.write(f"INSERT INTO {ipfx}root_Modifiers SELECT * FROM Modifiers WHERE ModifierId IN ("
                        + ", ".join(q(m) for m in mc) + ");\n")
            made = set()
            for child, snap, cc, pc, action in iplan:
                tbl = f"{ipfx}{child}" if action == "CASCADE" else f"{ipfx}set_{child}"
                if tbl not in made:
                    o.write(f"DROP TABLE IF EXISTS {tbl};\nCREATE TABLE {tbl} AS SELECT * FROM {child} WHERE 0;\n")
                    made.add(tbl)
                on = " AND ".join(f"c.{a} = p.{b}" for a, b in zip(cc, pc))
                o.write(f"INSERT INTO {tbl} SELECT c.* FROM {child} c WHERE EXISTS (SELECT 1 FROM {snap} p WHERE {on});\n")
            o.write("-- 2) Delete.\n")
            # Modifier ids: remove the earlier import's modifier (arguments, strings) and the requirement sets and
            # requirements only it uses, as 55-restore-parked-modifiers.sql does. Ids that Antiquity also defines
            # are parked anyway (00-pre-park-ids.sql) and get Antiquity's version back in 55.
            o.write("DROP TABLE IF EXISTS cc_inter_mod_ids;\nCREATE TABLE cc_inter_mod_ids (ModifierId TEXT PRIMARY KEY);\n")
            for mid in mc:
                o.write(f"INSERT INTO cc_inter_mod_ids VALUES ({q(mid)});\n")
            if mc:
                o.write("""DROP TABLE IF EXISTS cc_inter_sets;
CREATE TABLE cc_inter_sets AS SELECT RequirementSetId FROM RequirementSets WHERE RequirementSetId IN (
    SELECT SubjectRequirementSetId FROM Modifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_inter_mod_ids)
    UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_inter_mod_ids))
  AND RequirementSetId NOT IN (
    SELECT SubjectRequirementSetId FROM Modifiers WHERE SubjectRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_inter_mod_ids)
    UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE OwnerRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_inter_mod_ids));
DROP TABLE IF EXISTS cc_inter_reqs;
CREATE TABLE cc_inter_reqs AS SELECT RequirementId FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_inter_sets)
  AND RequirementId NOT IN (SELECT RequirementId FROM RequirementSetRequirements WHERE RequirementSetId NOT IN (SELECT RequirementSetId FROM cc_inter_sets));
DELETE FROM ModifierArguments WHERE ModifierId IN (SELECT ModifierId FROM cc_inter_mod_ids);
DELETE FROM ModifierStrings   WHERE ModifierId IN (SELECT ModifierId FROM cc_inter_mod_ids);
DELETE FROM Modifiers         WHERE ModifierId IN (SELECT ModifierId FROM cc_inter_mod_ids);
DELETE FROM RequirementArguments       WHERE RequirementId    IN (SELECT RequirementId FROM cc_inter_reqs);
DELETE FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_inter_sets);
DELETE FROM Requirements               WHERE RequirementId    IN (SELECT RequirementId FROM cc_inter_reqs);
DELETE FROM RequirementSets            WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_inter_sets);
DROP TABLE cc_inter_sets;
DROP TABLE cc_inter_reqs;
""")
            o.write("DROP TABLE cc_inter_mod_ids;\n")
            for (tn, vals), src in sorted(kc, key=lambda kv: kv[0][0] == "Types"):
                cond = " AND ".join(f"{c} = {q(v)}" for c, v in zip(pks[tn], vals))
                o.write(f"DELETE FROM {tn} WHERE {cond};  -- {src}\n")
        with open(os.path.join(MOD, "data", f"09-restore-{gid}.sql"), "w", encoding="utf-8", newline="\n") as o:
            o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
            o.write(f"-- Last item of {gid}: puts back rows that 09-dedupe-{gid}.sql's deletes cascaded into, unless the\n")
            o.write("-- import re-defined them (INSERT OR IGNORE); restores references reset by SET DEFAULT / SET NULL.\n")
            done = set()
            for child, snap, cc, pc, action in iplan:
                tbl = f"{ipfx}{child}" if action == "CASCADE" else f"{ipfx}set_{child}"
                if tbl in done: continue
                done.add(tbl)
                verb = "INSERT OR IGNORE" if action == "CASCADE" else "INSERT OR REPLACE"
                o.write(f"{verb} INTO {child} SELECT * FROM {tbl};\n")
            for t in sorted(done) + [f"{ipfx}root_{t}" for t in iroots]:
                o.write(f"DROP TABLE IF EXISTS {t};\n")
        if files["UpdateText"]:
            with open(os.path.join(MOD, "text", f"09-dedupe-{gid}-text.sql"), "w", encoding="utf-8", newline="\n") as o:
                o.write("-- GENERATED by tools/gen_dedupe.py - do not edit by hand.\n")
                o.write(f"-- Text tags that {gid} re-defines after an earlier import group added them.\n")
                if tc:
                    o.write("DELETE FROM LocalizedText WHERE Tag IN (\n  " + ",\n  ".join(q(t) for t in tc) + ");\n")
        inter_report.append(f"{gid}: {len(kc)} rows, {len(mc)} modifiers, {len(tc)} text tags re-defined; "
                            f"{len({c for c, *_ in iplan})} child tables snapshotted for restore")
    earlier_keys |= set(gkeys); earlier_mods |= gmods; earlier_tags |= gtags

print(f"gameplay collisions: {len(coll)}; modifier collisions (parked): {len(mcoll)}; text collisions: {len(tcoll)}")
for (tn, vals), src in coll.items(): print("  ", tn, vals, "<-", src)
for t in tcoll: print("   text", t)
print(f"text parked: {len(tpark)}")
for line in inter_report: print("inter-import", line)
