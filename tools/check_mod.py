"""Static checks of the mod before it is deployed or merged (no game needed, Python standard library only).

  python tools/check_mod.py [--game "<path to Civilization VII>"] [--ci]

Errors (exit code 1):
  - the .modinfo is not well-formed XML, lists a file that doesn't exist, or lists the same file twice in one action
  - an SQL statement doesn't parse (the kind of error that makes the game roll the whole mod back, such as a stray
    ";" inside a VALUES list), an XML file is not well-formed, a UI script has a syntax error (needs node)
  - with the game folder: an import names a base-game module or file that doesn't exist
Warnings: mod files no action lists, imports from DLC that isn't installed (owners-only groups), node missing.

SQL is checked statement by statement against an empty database: syntax errors are reported before table names are
looked up, so a statement that only fails with "no such table" (the game's tables aren't here) parsed fine.
--ci: no game folder expected (GitHub runners don't have the game); game-file imports are not checked.
"""
import argparse
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD = os.path.join(ROOT, "mod", "continuous-civ")
DEFAULT_GAME = r"G:/SteamLibrary/steamapps/common/Sid Meier's Civilization VII"
SYNTAX = ("syntax error", "unrecognized token", "incomplete input")

errors, warnings = [], []


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def strip_ns(tag):
    return tag.split("}", 1)[-1]


def check_modinfo():
    path = next((os.path.join(MOD, f) for f in os.listdir(MOD) if f.endswith(".modinfo")), None)
    if not path:
        errors.append("no .modinfo in " + rel(MOD))
        return set(), []
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        errors.append(f"{rel(path)}: not well-formed XML: {e}")
        return set(), []
    local, imports = set(), []
    for action in tree.iter():
        items = [c.text.strip() for c in action if strip_ns(c.tag) == "Item" and c.text]
        if not items:
            continue
        seen = set()
        for item in items:
            if item in seen:
                errors.append(f"{rel(path)}: {item} listed twice in one <{strip_ns(action.tag)}>")
            seen.add(item)
            m = re.match(r"\{([^}]+)\}(.*)", item)
            if m:
                imports.append((m.group(1), m.group(2)))
                continue
            local.add(item)
            if not os.path.isfile(os.path.join(MOD, item)):
                errors.append(f"{rel(path)}: lists {item}, which doesn't exist")
    return local, imports


def check_orphans(listed):
    for base, _, files in os.walk(MOD):
        for f in files:
            if f.endswith((".sql", ".xml", ".js")):
                r = os.path.relpath(os.path.join(base, f), MOD).replace(os.sep, "/")
                if r not in listed:
                    warnings.append(f"{rel(os.path.join(base, f))} is not listed in the .modinfo (never loaded)")


def module_folders(game):
    """Module id -> folder of its .modinfo (file paths are relative to it), for base modules and DLC."""
    out = {}
    for top in ("Base/modules", "DLC"):
        root = os.path.join(game, top)
        for base, dirs, files in os.walk(root):
            if base[len(root):].count(os.sep) > 2:
                dirs[:] = []
                continue
            for f in files:
                if not f.endswith(".modinfo"):
                    continue
                try:
                    mid = ET.parse(os.path.join(base, f)).getroot().attrib.get("id")
                except ET.ParseError:
                    mid = None
                if mid:
                    out[mid] = (base, top == "DLC")
    return out


def check_imports(imports, game):
    mods = module_folders(game)
    if not mods:
        errors.append(f"no game modules found under {game} (use --game or --ci)")
        return
    missing_dlc = set()
    for module, path in imports:
        if module not in mods:
            if module.startswith(("age-", "base-", "core")):
                errors.append(f"import from base module {{{module}}} that isn't in the game: {path}")
            else:
                missing_dlc.add(module)
            continue
        folder, _ = mods[module]
        if not os.path.isfile(os.path.join(folder, path)):
            errors.append(f"import {{{module}}}{path}: no such file in the installed game")
    if missing_dlc:
        warnings.append("imports from DLC not installed here (only checked on owners' machines): " + ", ".join(sorted(missing_dlc)))


def statements(text):
    """Split SQL text into statements the way sqlite does (strings and comments respected)."""
    buf = ""
    for line in text.splitlines(keepends=True):
        buf += line
        if sqlite3.complete_statement(buf):
            yield buf
            buf = ""
    if buf.strip() and sqlite3.complete_statement(buf + ";"):
        yield buf
    elif buf.strip() and re.sub(r"--[^\n]*|/\*.*?\*/", "", buf, flags=re.S).strip():
        yield buf  # unterminated: let sqlite report it


def check_sql(path):
    db = sqlite3.connect(":memory:")
    text = open(path, encoding="utf-8").read()
    line = 1
    for stmt in statements(text):
        start = line + len(stmt) - len(stmt.lstrip("\n"))
        try:
            db.execute(stmt)
        except sqlite3.Warning:
            pass
        except sqlite3.Error as e:
            msg = str(e)
            if any(s in msg for s in SYNTAX):
                first = next((l.strip() for l in stmt.splitlines() if l.strip() and not l.strip().startswith("--")), "")
                errors.append(f"{rel(path)}:{start}: {msg}  [{first[:70]}]")
        line += stmt.count("\n")
    db.close()


def check_xml(path):
    try:
        ET.parse(path)
    except ET.ParseError as e:
        errors.append(f"{rel(path)}: not well-formed XML: {e}")


def check_js(paths):
    node = shutil.which("node")
    if not node:
        warnings.append("node not found: UI scripts not syntax-checked")
        return
    for p in paths:
        r = subprocess.run([node, "--check", p], capture_output=True, text=True)
        if r.returncode:
            lines = r.stderr.strip().splitlines()
            where = next((l.strip() for l in lines if re.search(r"\.js:\d+", l)), "")
            what = next((l.strip() for l in lines if "Error" in l), "syntax error")
            errors.append(f"{rel(p)}: {what}  (at {where.rsplit(':', 1)[-1] if where else '?'})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default=None)
    ap.add_argument("--ci", action="store_true")
    a = ap.parse_args()
    listed, imports = check_modinfo()
    check_orphans(listed)
    if not a.ci:
        game = a.game or DEFAULT_GAME
        if os.path.isdir(game):
            check_imports(imports, game)
        else:
            warnings.append(f"game folder not found ({game}): imports not checked (pass --game)")
    js = []
    for base, _, files in os.walk(MOD):
        for f in sorted(files):
            p = os.path.join(base, f)
            if f.endswith(".sql"):
                check_sql(p)
            elif f.endswith(".xml"):
                check_xml(p)
            elif f.endswith(".js"):
                js.append(p)
    check_js(js)
    for w in warnings:
        print("WARNING: " + w)
    for e in errors:
        print("ERROR:   " + e)
    print(f"check_mod: {len(errors)} error(s), {len(warnings)} warning(s); {len(listed)} mod files and {len(imports)} game imports listed")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
