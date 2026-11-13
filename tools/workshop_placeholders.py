"""Prepare a deployed copy of the mod for the Firaxis Workshop Uploader.

The uploader checks that every file listed in the .modinfo exists inside the mod folder, but it does not
understand references to another module's files ({age-exploration}data/units.xml), which the game itself
supports and which this mod uses to read Exploration and Modern content from the player's installed game.
So it reports "Mod references files that are missing" and won't continue.

This script writes an empty placeholder at each such literal path (e.g. "<mod>/{age-exploration}data/units.xml")
so the check passes. The game ignores them: it resolves {age-exploration} to the game's own module.
Only run it on the deployed copy you upload (by default the Mods folder copy), never on the repository.

    python -I tools/workshop_placeholders.py            # add placeholders to the deployed mod
    python -I tools/workshop_placeholders.py --remove   # take them out again
"""
import os, re, shutil, sys

MOD = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Firaxis Games", "Sid Meier's Civilization VII", "Mods", "continuous-civ")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if args:
    MOD = args[0]
modinfo = os.path.join(MOD, "continuous-civ.modinfo")
if not os.path.isfile(modinfo):
    sys.exit(f"No continuous-civ.modinfo in {MOD}")

refs = sorted(set(re.findall(r"<Item>(\{[^}]+\}[^<]+)</Item>", open(modinfo, encoding="utf-8").read())))
tops = sorted({r.split("/")[0] for r in refs})  # e.g. "{age-exploration}data"

if "--remove" in sys.argv:
    for t in tops:
        shutil.rmtree(os.path.join(MOD, t), ignore_errors=True)
    print(f"Removed {len(tops)} placeholder folders from {MOD}")
    sys.exit(0)

for r in refs:
    path = os.path.join(MOD, *r.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Placeholder for the Workshop Uploader. The game loads this file from the "' + \
        r[1:r.index("}")] + '" module of your installed game. -->\n<Database/>\n'
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
print(f"Wrote {len(refs)} placeholders in {len(tops)} folders under {MOD}")
