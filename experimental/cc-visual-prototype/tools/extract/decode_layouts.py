"""Decode the attachment slots of the game's city layouts (read-only).

A layout asset (LAYOUT_*) lists named attachment points: hero-building lots, house blocks, road pieces,
trees. In the art package each attachment is a 40-byte transform record followed by a 32-byte record that
holds the FNV-1a hash of the attachment's full name:

  transform: u64 sequence, f32 0, f32 x, f32 y, f32 z, f32 0, f32 0, f32 turn (radians), f32 scale
  name:      u64 sequence, u32 hash, u32, u64 0, u64 kind

Positions are in world units (64 per tile spacing, x east, y north); turns are counter-clockwise.
Prints each attachment's position in tile units, turn in degrees and scale. No art is read or copied.

Usage: python -I decode_layouts.py LAYOUT_NAME [...]
"""
import glob
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_building_art as E  # noqa: E402

TILE = 64.0


def transforms(data, hash_pos):
    """The transform records just before and just after a name record (hash at hash_pos)."""
    out = []
    for start in (hash_pos - 8 - 40, hash_pos - 8 + 32):
        if start < 0 or start + 40 > len(data):
            out.append(None)
            continue
        f = struct.unpack_from("<8f", data, start + 8)
        out.append(f)
    return out


def main(names):
    argv, sys.argv = sys.argv, sys.argv[:1]  # find_base reads argv[1] as the game folder
    base = E.find_base()
    sys.argv = argv
    files = sorted(glob.glob(os.path.join(base, "Platforms", "Windows", "BLPs", "*.blp")))
    for layout in names:
        prefix = layout + "_DirectAttachment_"
        for f in files:
            data = open(f, "rb").read()
            if prefix.encode() not in data:
                continue
            tab = E.string_table(data)
            atts = sorted({s for s in tab if s.startswith(prefix)})
            if not atts:
                continue
            print(f"{layout}  ({os.path.basename(f)}, {len(atts)} attachments)")
            for full in atts:
                hb = struct.pack("<I", E.fnv1a(full))
                p = data.find(hb)
                short = full[len(prefix):]
                if p < 0:
                    print(f"  {short:45s} no record")
                    continue
                before, after = transforms(data, p)
                for tag, t in (("before", before), ("after", after)):
                    if not t:
                        continue
                    _, x, y, z, _, _, turn, scale = t
                    print(f"  {short:45s} {tag:6s} x={x / TILE:7.3f} y={y / TILE:7.3f} z={z:7.2f} "
                          f"turn={math.degrees(turn):7.1f} scale={scale:6.3f}")
            break


if __name__ == "__main__":
    main(sys.argv[1:] or ["LAYOUT_CTY_MOD_Section_AB_Small_Packed"])
