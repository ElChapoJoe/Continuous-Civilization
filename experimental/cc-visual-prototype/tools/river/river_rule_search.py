"""River-turn rule search (round 50-52, no rule found): which river tiles keep the coordinate's street turn.

  python -I river_rule_search.py

Inputs next to this script: river courses exported with riverdump.js (debug console; "x,y[N]:<six neighbour flags>"
per plot, rivers separated by "|", N = navigable, flags w water / n navigable river / - land), and the street
tables in the folder above. Kept for the river-height test planned for Tiny.
"""
import json, collections, sys, itertools
import os
N = os.path.dirname(os.path.abspath(__file__))  # river dumps live next to this script
T = os.path.join(N, '..')  # street tables
tb = {'A0': 0, 'B300': 0, 'A60': 1, 'B0': 1}
def load(f):
    d = json.load(open(f)); return d['tiles'], set(d.get('rivers', []))
tables = {s: load(os.path.join(T, 'street-table-small-%s.json' % s)) for s in ('1001', '2002', '3003')}
tables['5005'] = load(os.path.join(T, 'street-table-small-5005.json'))
tables['6006'] = load(os.path.join(T, 'street-table-small-6006.json'))
def base_for(k, exclude):
    for s, (t, R) in tables.items():
        if s == exclude or k in R or k not in t: continue
        v = t[k]
        if v[1] >= 2.5 and v[0] in tb: return tb[v[0]]
    return None
def nbr(x, y, d):
    o = y & 1
    return {0: (x + o, y + 1), 1: (x + 1, y), 2: (x + o, y - 1), 3: (x - 1 + o, y - 1), 4: (x - 1, y), 5: (x - 1 + o, y + 1)}[d]
def dir_to(a, b):
    for d in range(6):
        if nbr(a[0], a[1], d) == b: return d
    return None
rows = []
def add_map(seed, chains_text, wmask_known):
    t, R = tables[seed]
    for c in chains_text.strip().split('|'):
        pts = []
        for p in c.split():
            q, _, w = p.partition(':')
            nav = q.endswith('N'); q = q.rstrip('N')
            x, y = map(int, q.split(','))
            pts.append((x, y, nav, w if wmask_known else None))
        for i, (x, y, nav, w) in enumerate(pts):
            if nav: continue
            k = '%d,%d' % (x, y)
            if k not in t or t[k][1] < 2.5 or t[k][0] not in tb: continue
            conn = set()
            for j in (i - 1, i + 1):
                if 0 <= j < len(pts):
                    d = dir_to((x, y), (pts[j][0], pts[j][1]))
                    if d is not None: conn.add(d)
            mouth = (i == 0) or (pts[i - 1][2] if i > 0 else False)
            if w and i == 0:
                for d in range(6):
                    if w[d] != '-': conn.add(d)
            rows.append(dict(seed=seed, k=k, turn=tb[t[k][0]], ab=t[k][0][0], base=base_for(k, seed), conn=frozenset(conn), mouth=i == 0, n=len(pts)))
add_map('2002', open(N + '/riverdump_small2002.txt').read(), True)
add_map('5005', open(N + '/riverdump_small5005.txt').read(), True)
add_map('6006', open(N + '/riverdump_small6006.txt').read(), True)
# 1001: chains without water masks; add water dirs from the east-half geo file where known
geo = {}
for e in open(N + '/rivergeo_small1001.txt').read().strip().split(';'):
    x, y, el, w, r, ne = e.split(':'); geo[x + ',' + y] = w
ch = []
for c in open(N + '/riverchains_small1001.txt').read().strip().split('|'):
    ch.append(' '.join(p + ':' + geo.get(p.rstrip('N'), '------') for p in c.split()))
add_map('1001', '|'.join(ch), True)
wb = [r for r in rows if r['base'] is not None]
print('river tiles', len(rows), 'with base', len(wb), 'flip rate %.2f' % (sum(r['turn'] != r['base'] for r in wb) / max(1, len(wb))))
best = []
for s in (1, -1):
    for FA in range(64):
        for FB in range(64):
            acc = 0
            for r in wb:
                F = FA if r['ab'] == 'A' else FB
                rel = [((d - s * r['base']) % 6) for d in r['conn']]
                pred_flip = any(F >> q & 1 for q in rel)
                acc += pred_flip == (r['turn'] != r['base'])
            best.append((acc, s, FA, FB))
best.sort(reverse=True)
for b in best[:8]: print('acc %d/%d sign %d FA %s FB %s' % (b[0], len(wb), b[1], format(b[2], '06b')[::-1], format(b[3], '06b')[::-1]))
# alternative: turn directly = f(ab, conn rel) ignoring base
print('--- rule: keep base unless it clashes and the other turn does not')
best = []
for s in (1, -1):
    for FA in range(64):
        for FB in range(64):
            acc = 0
            for r in wb:
                F = FA if r['ab'] == 'A' else FB
                clash = lambda T: any(F >> ((d - s * T) % 6) & 1 for d in r['conn'])
                b = r['base']; o = 1 - b
                pred = o if (clash(b) and not clash(o)) else b
                acc += pred == r['turn']
            best.append((acc, s, FA, FB))
best.sort(reverse=True)
for b in best[:6]: print('acc %d/%d sign %d FA %s FB %s' % (b[0], len(wb), b[1], format(b[2], '06b')[::-1], format(b[3], '06b')[::-1]))
print('--- turn as a pure function of (ab, conn set): consistency ceiling')
g = collections.defaultdict(collections.Counter)
for r in rows: g[(r['ab'], r['conn'])][r['turn']] += 1
print('ceiling %d/%d over %d groups' % (sum(max(c.values()) for c in g.values()), len(rows), len(g)))
g = collections.defaultdict(collections.Counter)
for r in wb: g[(r['ab'], r['base'], r['conn'])][r['turn']] += 1
print('with base: ceiling %d/%d over %d groups' % (sum(max(c.values()) for c in g.values()), len(wb), len(g)))
