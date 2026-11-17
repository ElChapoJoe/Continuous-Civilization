"""Is the generated SQL up to date? Runs every generator against the installed game and compares (needs the game, so
it runs on the dev PC: from deploy.ps1 and the pre-commit hook, not on GitHub).

  python -I tools/check_generated.py [--update]

Snapshots mod/continuous-civ, runs the generators in the documented order (CONTRIBUTING.md "Workflow"), lists every
file they changed, added or removed, then puts the snapshot back, so the check leaves the working tree as it was.
--update keeps the regenerated files instead. Exit code 1 when something was out of date (without --update).
"""
import hashlib
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD = os.path.join(ROOT, "mod", "continuous-civ")
GENERATORS = ["gen_dedupe.py", "gen_modern_resources.py", "gen_dedications.py", "gen_civ_abilities.py", "gen_prune_fk.py"]
update = "--update" in sys.argv[1:]


def snapshot():
    out = {}
    for d, _, files in os.walk(MOD):
        for f in files:
            p = os.path.join(d, f)
            out[os.path.relpath(p, MOD)] = open(p, "rb").read()
    return out


before = snapshot()
failed = []
for g in GENERATORS:
    r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools", g)], capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        failed.append(f"{g} failed: {(r.stderr or r.stdout).strip()[-300:]}")
after = snapshot()

# Line endings don't count: git may check files out with CRLF while the generators write LF.
same = lambda a, b: hashlib.sha1(a.replace(b"\r\n", b"\n")).digest() == hashlib.sha1(b.replace(b"\r\n", b"\n")).digest()
changed = sorted(k for k in before if k in after and not same(before[k], after[k]))
added = sorted(k for k in after if k not in before)
removed = sorted(k for k in before if k not in after)

if not update:   # put the working tree back exactly as it was, byte for byte (line endings included)
    for k in added:
        os.remove(os.path.join(MOD, k))
    for k in [k for k in before if k not in after or before[k] != after[k]]:
        os.makedirs(os.path.dirname(os.path.join(MOD, k)), exist_ok=True)
        with open(os.path.join(MOD, k), "wb") as f:
            f.write(before[k])

for line in failed:
    print("FAIL", line)
for k in changed:
    print("STALE  ", k.replace(os.sep, "/"))
for k in added:
    print("NEW    ", k.replace(os.sep, "/"))
for k in removed:
    print("REMOVED", k.replace(os.sep, "/"))
stale = changed or added or removed
if failed:
    sys.exit(2)
if stale and not update:
    print(f"{len(changed) + len(added) + len(removed)} generated file(s) out of date: run python -I tools/check_generated.py --update (or the generators) and commit them")
    sys.exit(1)
print("generated files kept up to date (--update)" if stale else "generated files up to date")
