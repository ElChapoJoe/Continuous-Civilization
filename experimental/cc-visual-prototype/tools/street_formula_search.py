"""Search for a formula that predicts the street layout the engine paints on a city tile.

Input: labels.json from street_probe_score.py (per tile: x, y, district id, constructible id, street A/B, angle,
margin). For many integer inputs (plot index, coordinates, ids, with and without the map seed) and many common hash
and random-number functions, it checks whether the measured label is a function of the hash value: by remainder
(h % m), by bit field, or by position when the tiles are sorted by h (what "pick by random float" would give).
Prints the best fits; a real rule would explain all (or nearly all) tiles.

  python street_formula_search.py labels.json [min_margin] [grid_width] [seed ...]
"""
import itertools
import json
import struct
import sys
import zlib

M32 = 0xFFFFFFFF
labels = json.load(open(sys.argv[1]))
min_margin = float(sys.argv[2]) if len(sys.argv) > 2 else 1.25
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 60
SEEDS = [int(s) for s in sys.argv[4:]] or [0]
tiles = [t for t in labels if t["margin"] >= min_margin and t["angle"] in (0, 60, 300)]
N = len(tiles)
full = [t["street"] + str(t["angle"]) for t in tiles]
ab = [t["street"] for t in tiles]
print(N, "tiles:", " ".join(sorted(set(full), key=full.index)), {k: full.count(k) for k in set(full)})


def fmix32(h):
    h ^= h >> 16; h = h * 0x85EBCA6B & M32; h ^= h >> 13; h = h * 0xC2B2AE35 & M32; h ^= h >> 16
    return h


def wang(h):
    h = (h ^ 61) ^ (h >> 16); h = h * 9 & M32; h ^= h >> 4; h = h * 0x27D4EB2D & M32; h ^= h >> 15
    return h


def xorshift(h):
    h = h or 1
    h ^= h << 13 & M32; h ^= h >> 17; h ^= h << 5 & M32
    return h


def splitmix(h):
    z = (h + 0x9E3779B97F4A7C15) & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9 & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 27)) * 0x94D049BB133111EB & 0xFFFFFFFFFFFFFFFF
    return (z ^ (z >> 31)) & M32


def splitmix_hi(h):
    z = (h + 0x9E3779B97F4A7C15) & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9 & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 27)) * 0x94D049BB133111EB & 0xFFFFFFFFFFFFFFFF
    return (z ^ (z >> 31)) >> 32


def fnv_bytes(b, bits=32):
    if bits == 32:
        h = 0x811C9DC5
        for c in b:
            h = (h ^ c) * 0x01000193 & M32
        return h
    h = 0xCBF29CE484222325
    for c in b:
        h = (h ^ c) * 0x100000001B3 & 0xFFFFFFFFFFFFFFFF
    return h & M32


def fnv1_bytes(b):
    h = 0x811C9DC5
    for c in b:
        h = (h * 0x01000193 & M32) ^ c
    return h


def jenkins(b):
    h = 0
    for c in b:
        h = (h + c) & M32; h = (h + (h << 10)) & M32; h ^= h >> 6
    h = (h + (h << 3)) & M32; h ^= h >> 11; h = (h + (h << 15)) & M32
    return h


def murmur3(b, seed=0):
    h = seed
    for i in range(0, len(b) - len(b) % 4, 4):
        k = struct.unpack_from("<I", b, i)[0]
        k = k * 0xCC9E2D51 & M32; k = (k << 15 | k >> 17) & M32; k = k * 0x1B873593 & M32
        h ^= k; h = (h << 13 | h >> 19) & M32; h = (h * 5 + 0xE6546B64) & M32
    return fmix32(h ^ len(b))


def mt_first(seed):
    mt = [seed & M32]
    for i in range(1, 624):
        mt.append((1812433253 * (mt[-1] ^ (mt[-1] >> 30)) + i) & M32)
    y = (mt[0] & 0x80000000) | (mt[1] & 0x7FFFFFFF)
    v = mt[397] ^ (y >> 1) ^ (0x9908B0DF if y & 1 else 0)
    v ^= v >> 11; v ^= (v << 7) & 0x9D2C5680; v ^= (v << 15) & 0xEFC60000; v ^= v >> 18
    return v


def pcg(h):
    state = (h * 747796405 + 2891336453) & M32
    word = ((state >> ((state >> 28) + 4)) ^ state) * 277803737 & M32
    return (word >> 22) ^ word


INT_HASHES = {
    "id": lambda h: h & M32,
    "fmix32": fmix32, "wang": wang, "xorshift32": xorshift, "splitmix": splitmix, "splitmix_hi": splitmix_hi, "pcg": pcg,
    "lcg_msvc": lambda h: ((h * 214013 + 2531011) & M32) >> 16 & 0x7FFF,
    "lcg_msvc2": lambda h: ((((h * 214013 + 2531011) & M32) * 214013 + 2531011) & M32) >> 16 & 0x7FFF,
    "lcg_nr": lambda h: (h * 1664525 + 1013904223) & M32,
    "lcg_nr_hi": lambda h: ((h * 1664525 + 1013904223) & M32) >> 16,
    "minstd": lambda h: (h or 1) * 48271 % 2147483647,
    "minstd0": lambda h: (h or 1) * 16807 % 2147483647,
    "knuth": lambda h: h * 2654435761 & M32,
    "knuth_hi": lambda h: (h * 2654435761 & M32) >> 16,
    "mt19937": mt_first,
    "fnv1a_le4": lambda h: fnv_bytes(struct.pack("<I", h & M32)),
    "fnv1a64_le4": lambda h: fnv_bytes(struct.pack("<I", h & M32), 64),
    "fnv1a64_le8": lambda h: fnv_bytes(struct.pack("<Q", h & M32), 64),
    "fnv1_le4": lambda h: fnv1_bytes(struct.pack("<I", h & M32)),
    "fnv1a_str": lambda h: fnv_bytes(str(h).encode()),
    "jenkins_le4": lambda h: jenkins(struct.pack("<I", h & M32)),
    "crc32_le4": lambda h: zlib.crc32(struct.pack("<I", h & M32)),
    "murmur3_le4": lambda h: murmur3(struct.pack("<I", h & M32)),
    "adler_le4": lambda h: zlib.adler32(struct.pack("<I", h & M32)),
}


def inputs(t, seed):
    x, y, did, cid = t["x"], t["y"], t["did"], t["cid"]
    pi = y * WIDTH + x
    base = {"x": x, "y": y, "plot": pi, "plot+1": pi + 1, "did": did, "did_lo": did & 0xFFFF, "did_hi": did >> 16,
            "cid": cid, "cid_lo": cid & 0xFFFF, "cid_hi": cid >> 16, "x^y": x ^ y, "x+y": x + y,
            "x*73856093^y*19349663": (x * 73856093 ^ y * 19349663) & M32, "x<<16|y": x << 16 | y, "y<<16|x": y << 16 | x,
            "x*31+y": x * 31 + y, "y*31+x": y * 31 + x, "did+cid": did + cid, "did^cid": did ^ cid}
    out = dict(base)
    if seed:
        for k, v in base.items():
            out[k + "^seed"] = v ^ seed
            out[k + "+seed"] = (v + seed) & M32
            out[k + "*seed"] = (v * seed) & M32
    return out


PAIR = {
    "pair_fnv": lambda a, b: fnv_bytes(struct.pack("<II", a & M32, b & M32)),
    "pair_murmur": lambda a, b: murmur3(struct.pack("<II", a & M32, b & M32)),
    "pair_murmur_seeded": lambda a, b: murmur3(struct.pack("<I", a & M32), b & M32),
    "pair_crc": lambda a, b: zlib.crc32(struct.pack("<II", a & M32, b & M32)),
    "pair_jenkins": lambda a, b: jenkins(struct.pack("<II", a & M32, b & M32)),
    "pair_boost": lambda a, b: (a ^ (b + 0x9E3779B9 + (a << 6) + (a >> 2))) & M32,
}


def purity(keys, lab):
    groups = {}
    for k, l in zip(keys, lab):
        groups.setdefault(k, []).append(l)
    return sum(max(g.count(v) for v in set(g)) for g in groups.values()), len(groups)


def runs(order, lab):
    seq = [lab[i] for i in order]
    return 1 + sum(1 for a, b in zip(seq, seq[1:]) if a != b)


results = []


def evaluate(name, hs):
    for lab_name, lab in (("full", full), ("AB", ab)):
        classes = len(set(lab))
        for m in range(2, 13):
            p, g = purity([h % m for h in hs], lab)
            results.append((p - (g - classes if g > classes else 0) * 0.0, p, "%s %% %d [%s] groups %d" % (name, m, lab_name, g)))
        for s in range(0, 31):
            for width in (1, 2, 3):
                p, g = purity([(h >> s) & ((1 << width) - 1) for h in hs], lab)
                results.append((p, p, "%s >>%d &%d [%s] groups %d" % (name, s, (1 << width) - 1, lab_name, g)))
        r = runs(sorted(range(N), key=lambda i: hs[i]), lab)
        results.append((N - (r - classes), N - (r - classes), "%s sorted runs %d [%s]" % (name, r, lab_name)))


def main():
    for seed in SEEDS:
        ins = [inputs(t, seed) for t in tiles]
        for key in ins[0]:
            vals = [i[key] for i in ins]
            for hn, hf in INT_HASHES.items():
                evaluate("%s(%s)%s" % (hn, key, " seed %d" % seed if seed else ""), [hf(v) for v in vals])
        base_keys = ["x", "y", "plot", "did", "did_lo", "cid", "cid_lo"]
        for a, b in itertools.permutations(base_keys, 2):
            for pn, pf in PAIR.items():
                evaluate("%s(%s,%s)" % (pn, a, b), [pf(i[a], i[b]) for i in ins])
        if seed:
            for a in base_keys:
                for pn, pf in PAIR.items():
                    evaluate("%s(%s,seed %d)" % (pn, a, seed), [pf(i[a], seed) for i in ins])
                    evaluate("%s(seed %d,%s)" % (pn, seed, a), [pf(seed, i[a]) for i in ins])

    print(len(results), "hypotheses tested")
    for lab_name in ("full", "AB"):
        best = sorted((r for r in results if "[%s]" % lab_name in r[2]), key=lambda r: -r[0])[:8]
        print("best for", lab_name, "(tiles explained of %d):" % N)
        for score, p, desc in best:
            print("  %5.1f  %s" % (score, desc))

    print("\nby district order:", " ".join(full[i] for i in sorted(range(N), key=lambda i: tiles[i]["did"])))
    print("by plot index:    ", " ".join(full[i] for i in sorted(range(N), key=lambda i: tiles[i]["y"] * WIDTH + tiles[i]["x"])))


if __name__ == "__main__":
    main()
