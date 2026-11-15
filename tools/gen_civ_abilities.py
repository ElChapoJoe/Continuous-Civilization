"""Generate the per-Age civ ability data for the continuous-civ mod (data/75-civ-abilities.sql).

In vanilla each civilization's ability is attached per Age: every module (age-antiquity, age-exploration, age-modern,
each civ DLC) has civilizations-antiquity.xml, civilizations-exploration.xml and civilizations-modern.xml, and only the
file of the current Age loads. So a civ's ability changes at each Age transition: an Exploration civ played from
Antiquity has a "Test of Time" version in Antiquity and its real ability in Exploration; Rome keeps most of its
ability but gets Exploration text and changes. The game Age is always Antiquity here, so only the Antiquity files
loaded, for every civ, all game.

This script reads (read-only) those files and writes:
  cc_civ_ability_rows   TraitType, ModifierId, InAQ, InEX, InMO: which Ages vanilla attaches each ability modifier in
                        (an Age with no file for that civ counts as the Age before it)
  copies of the Requirements / RequirementSets the Exploration and Modern files define (INSERT OR IGNORE), and their
  ModifierArguments <Replace> rows, which the ability modifiers use.
data/75-civ-abilities.sql (hand-written part, appended below) then attaches each modifier only while the civ's
personal Age is one of the Ages vanilla has it in. The modifier definitions themselves come from the gameeffects files
the modinfo imports.

Age-wide traits (TRAIT_ANTIQUITY_CIV, TRAIT_EXPLORATION_CIV, TRAIT_MODERN_CIV, TRAIT_ANACHRONISTIC_CIV) and the
civic-tree reveals (MOD_REVEAL_CIV_CULTURE_TREE_*, handled in 84-civ-trees.sql) are left out.

Re-run after every game patch or DLC:  python -I tools/gen_civ_abilities.py "<Civ7 install>/Base"
"""
import os, re, sys
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
OUT = os.path.join(HERE, "..", "mod", "continuous-civ", "data", "75-civ-abilities.sql")
LOGIC = os.path.join(HERE, "civ_abilities_logic.sql")
BASE = find_civ7_base()
DLC = os.path.join(os.path.dirname(BASE), "DLC")
AGES = ("antiquity", "exploration", "modern")
SKIP_TRAITS = {"TRAIT_ANTIQUITY_CIV", "TRAIT_EXPLORATION_CIV", "TRAIT_MODERN_CIV", "TRAIT_ANACHRONISTIC_CIV"}


def q(s): return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"


def modules():
    for m in ("age-antiquity", "age-exploration", "age-modern"):
        yield m, os.path.join(BASE, "modules", m, "data")
    if os.path.isdir(DLC):
        for c in sorted(os.listdir(DLC)):
            d = os.path.join(DLC, c, "modules", "data")
            if os.path.isdir(d):
                yield c, d


def rows(root, table):
    for t in root.iter(table):
        for r in t:
            if r.tag in ("Row", "Replace"):
                yield r.tag, r.attrib


ability = {}          # (trait, modifier) -> set of ages
trait_ages = {}       # trait -> ages it has a file for
reqs, reqargs, reqsets, reqsetreqs, replace_args = {}, set(), {}, set(), []
for mod, data in modules():
    for age in AGES:
        f = os.path.join(data, "civilizations-%s.xml" % age)
        if not os.path.isfile(f):
            continue
        root = ET.parse(f).getroot()
        for _, a in rows(root, "TraitModifiers"):
            t, m = a.get("TraitType"), a.get("ModifierId")
            if not t or not m or t in SKIP_TRAITS or m.startswith("MOD_REVEAL_CIV_CULTURE_TREE"):
                continue
            ability.setdefault((t, m), set()).add(age)
            trait_ages.setdefault(t, set()).add(age)
        if age == "antiquity":
            continue   # already loaded by vanilla in this (Antiquity) game
        for _, a in rows(root, "Requirements"):
            reqs[a["RequirementId"]] = a
        for _, a in rows(root, "RequirementArguments"):
            reqargs.add((a["RequirementId"], a["Name"], a["Value"]))
        for _, a in rows(root, "RequirementSets"):
            reqsets[a["RequirementSetId"]] = a.get("RequirementSetType", "REQUIREMENTSET_TEST_ALL")
        for _, a in rows(root, "RequirementSetRequirements"):
            reqsetreqs.add((a["RequirementSetId"], a["RequirementId"]))
        for tag, a in rows(root, "ModifierArguments"):
            if tag == "Replace":
                replace_args.append((a["ModifierId"], a["Name"], a["Value"]))

# An Age with no file for a civ keeps the Age before it (a civ without Modern data keeps its Exploration ability).
out_rows = []
for (t, m), ages in sorted(ability.items()):
    have = trait_ages[t]
    present = {}
    prev = None
    for age in AGES:
        if age in have:
            prev = age in ages
        present[age] = bool(prev)
    out_rows.append((t, m, int(present["antiquity"]), int(present["exploration"]), int(present["modern"])))

lines = [
    "-- GENERATED by tools/gen_civ_abilities.py from the installed game's civilizations-<age>.xml files (base game and",
    "-- civ DLCs). Do not edit by hand: change tools/civ_abilities_logic.sql or the script, then re-run it.",
    "-- " + str(len(out_rows)) + " ability rows, " + str(len(reqs)) + " requirements, " + str(len(reqsets)) + " requirement sets.",
    "",
    "DROP TABLE IF EXISTS cc_civ_ability_rows;",
    "CREATE TABLE cc_civ_ability_rows (TraitType TEXT, ModifierId TEXT, InAQ INTEGER, InEX INTEGER, InMO INTEGER, PRIMARY KEY (TraitType, ModifierId));",
]
for i in range(0, len(out_rows), 200):
    chunk = out_rows[i:i + 200]
    lines.append("INSERT INTO cc_civ_ability_rows VALUES\n  " + ",\n  ".join("(%s, %s, %d, %d, %d)" % (q(t), q(m), a, e, o) for t, m, a, e, o in chunk) + ";")
lines.append("")
lines.append("-- Requirements the Exploration / Modern ability modifiers use (vanilla defines them in those Ages' files).")
for rid, a in sorted(reqs.items()):
    lines.append("INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType, Inverse) VALUES (%s, %s, %d);"
                 % (q(rid), q(a.get("RequirementType")), 1 if str(a.get("Inverse", "false")).lower() in ("true", "1") else 0))
for rid, n, v in sorted(reqargs):
    lines.append("INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value) VALUES (%s, %s, %s);" % (q(rid), q(n), q(v)))
for sid, typ in sorted(reqsets.items()):
    lines.append("INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES (%s, %s);" % (q(sid), q(typ)))
for sid, rid in sorted(reqsetreqs):
    lines.append("INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES (%s, %s);" % (q(sid), q(rid)))
lines.append("-- Argument replacements of the Exploration / Modern files (applied only if the modifier exists).")
for mid, n, v in replace_args:
    lines.append("INSERT OR REPLACE INTO ModifierArguments (ModifierId, Name, Value) SELECT %s, %s, %s WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = %s);"
                 % (q(mid), q(n), q(v), q(mid)))
lines.append("")
lines.append(open(LOGIC, encoding="utf-8").read())
open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines))

gated = sum(1 for r in out_rows if not (r[2] and r[3] and r[4]))
print("wrote %s: %d ability rows (%d change with the Age), %d requirements" % (os.path.relpath(OUT), len(out_rows), gated, len(reqs)))
