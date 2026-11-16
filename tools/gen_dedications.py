"""Generate the Dedication card data for the continuous-civ mod (data/82-dedication-cards.sql).

In vanilla, a Major Triumph grants an unlock (UNLOCK_AQ_*, UNLOCK_EX_*), and at the next Age transition the
matching Dedication card appears in the advanced-start deck (age-exploration/age-modern data/age-transition.xml),
where the player picks up to 3. A card applies the modifiers of its effects (AdvancedStartCardEffects ->
age-transition-gameeffects.xml). There is no Age transition here, so data/83-dedications.sql turns these cards into
a Dedications attribute tree. This script reads (read-only) the installed game and writes staging rows:

  cc_dedication_cards      CardId, Age (EX = earned in Antiquity, picked in Exploration; MO = earned in
                           Exploration, picked in Modern), Unlock, Name, Description (text keys)
  cc_dedication_effects    CardId, ModifierId (the card's top-level modifiers, renamed CC_DM_*)
  cc_ded_mods / _args / _strings / _reqsets / _reqs / _reqargs
                           those modifiers and every modifier, requirement set and requirement they reference
                           in age-transition-gameeffects.xml, renamed CC_DM_* so nothing clashes

Re-run after every game patch:  python -I tools/gen_dedications.py "<Civ7 install>/Base"
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
OUT = os.path.join(HERE, "..", "mod", "continuous-civ", "data", "82-dedication-cards.sql")
BASE = find_civ7_base()


def strip(t): return t.split("}")[-1]
def q(s): return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
def boolv(v): return 1 if str(v).lower() in ("true", "1") else 0


cards, effects = [], []
mods, args, strings, reqsets, reqs, reqargs = [], [], [], [], [], []
done_mods, done_sets = set(), set()
req_counter = [0]

for age, tag, prev in (("exploration", "EX", "AQ"), ("modern", "MO", "EX")):
    data = os.path.join(BASE, "modules", "age-" + age, "data")
    root = ET.parse(os.path.join(data, "age-transition.xml")).getroot()
    card_effects, age_cards = {}, []
    for table in root:
        if strip(table.tag) == "AdvancedStartCardEffects":
            for r in table:
                card_effects[r.get("EffectID")] = r.get("EffectType")
        elif strip(table.tag) == "AdvancedStartCards":
            for r in table:
                if re.match(r"UNLOCK_%s_" % prev, r.get("Unlock") or ""):
                    age_cards.append(r)
    gfx = ET.parse(os.path.join(data, "age-transition-gameeffects.xml")).getroot()
    defs = {m.get("id"): m for m in gfx if strip(m.tag) == "Modifier"}
    set_defs = {s.get("id"): s for s in gfx if strip(s.tag) == "RequirementSet"}

    def new_name(old): return "CC_DM_" + old

    def add_set(set_id, el, set_type):
        """A requirement set from inline <SubjectRequirements>/<OwnerRequirements> or a named <RequirementSet>."""
        if set_id in done_sets:
            return
        done_sets.add(set_id)
        reqsets.append((set_id, set_type))
        for r in el:
            if strip(r.tag) != "Requirement":
                continue
            req_counter[0] += 1
            rid = "CC_DMREQ_%d" % req_counter[0]
            reqs.append((set_id, rid, r.get("type"), boolv(r.get("inverse", "false"))))
            for a in r:
                if strip(a.tag) != "Argument":
                    continue
                v = (a.text or "").strip()
                if a.get("name") == "RequirementSetId" and v in set_defs:
                    add_set(new_name(v), set_defs[v], set_defs[v].get("type", "REQUIREMENTSET_TEST_ALL"))
                    v = new_name(v)
                reqargs.append((rid, a.get("name"), v))

    def add_mod(mid):
        if mid in done_mods:
            return new_name(mid)
        done_mods.add(mid)
        m = defs[mid]
        nid = new_name(mid)
        subj = own = None
        for c in m:
            t = strip(c.tag)
            if t == "SubjectRequirements":
                subj = nid + "_SUBJECT"
                add_set(subj, c, c.get("type", "REQUIREMENTSET_TEST_ALL"))
            elif t == "OwnerRequirements":
                own = nid + "_OWNER"
                add_set(own, c, c.get("type", "REQUIREMENTSET_TEST_ALL"))
            elif t == "Argument":
                v = (c.text or "").strip()
                if c.get("name") == "ModifierId":
                    v = ", ".join(add_mod(x.strip()) if x.strip() in defs else x.strip() for x in v.split(","))
                args.append((nid, c.get("name"), v, c.get("type"), c.get("extra")))
            elif t == "String":
                strings.append((nid, c.get("context"), (c.text or "").strip()))
        mods.append((nid, m.get("collection"), m.get("effect"), boolv(m.get("run-once")), boolv(m.get("new-only")),
                     boolv(m.get("permanent")), m.get("owner-stack-limit"), m.get("subject-stack-limit"), subj, own))
        return nid

    for c in age_cards:
        cid = c.get("CardID")
        cards.append((cid, tag, c.get("Unlock"), c.get("Name"), c.get("Description")))
        for k in sorted(k for k in c.attrib if k.startswith("CardEffectType")):
            et = card_effects[c.get(k)]
            if et not in defs:
                sys.exit(f"{cid}: effect {et} is not a modifier in age-transition-gameeffects.xml")
            effects.append((cid, add_mod(et)))

lines = ["-- GENERATED by tools/gen_dedications.py - do not edit by hand. Staging rows for 83-dedications.sql.",
         "DROP TABLE IF EXISTS cc_dedication_cards;",
         "CREATE TABLE cc_dedication_cards (CardId TEXT PRIMARY KEY, Age TEXT, Unlock TEXT, Name TEXT, Description TEXT);",
         "DROP TABLE IF EXISTS cc_dedication_effects;",
         "CREATE TABLE cc_dedication_effects (CardId TEXT, ModifierId TEXT);",
         "DROP TABLE IF EXISTS cc_ded_mods;",
         "CREATE TABLE cc_ded_mods (ModifierId TEXT PRIMARY KEY, CollectionType TEXT, EffectType TEXT, RunOnce INTEGER,"
         " NewOnly INTEGER, Permanent INTEGER, OwnerStackLimit INTEGER, SubjectStackLimit INTEGER,"
         " SubjectRequirementSetId TEXT, OwnerRequirementSetId TEXT);",
         "DROP TABLE IF EXISTS cc_ded_args;",
         "CREATE TABLE cc_ded_args (ModifierId TEXT, Name TEXT, Value TEXT, Type TEXT, Extra TEXT);",
         "DROP TABLE IF EXISTS cc_ded_strings;",
         "CREATE TABLE cc_ded_strings (ModifierId TEXT, Context TEXT, Text TEXT);",
         "DROP TABLE IF EXISTS cc_ded_reqsets;",
         "CREATE TABLE cc_ded_reqsets (RequirementSetId TEXT PRIMARY KEY, RequirementSetType TEXT);",
         "DROP TABLE IF EXISTS cc_ded_reqs;",
         "CREATE TABLE cc_ded_reqs (RequirementSetId TEXT, RequirementId TEXT PRIMARY KEY, RequirementType TEXT, Inverse INTEGER);",
         "DROP TABLE IF EXISTS cc_ded_reqargs;",
         "CREATE TABLE cc_ded_reqargs (RequirementId TEXT, Name TEXT, Value TEXT);"]


def emit(table, rows):
    for r in rows:
        lines.append("INSERT INTO %s VALUES (%s);" % (table, ", ".join(q(x) for x in r)))


emit("cc_dedication_cards", cards)
emit("cc_dedication_effects", effects)
emit("cc_ded_mods", mods)
emit("cc_ded_args", args)
emit("cc_ded_strings", strings)
emit("cc_ded_reqsets", reqsets)
emit("cc_ded_reqs", reqs)
emit("cc_ded_reqargs", reqargs)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines) + "\n")
print(f"{len(cards)} cards, {len(effects)} card effects, {len(mods)} modifiers, {len(reqsets)} requirement sets -> {OUT}")
