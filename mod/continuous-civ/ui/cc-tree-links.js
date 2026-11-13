// Continuous Civilization - fix broken links in the tech and civic tree screens (UI only, display only).
// The merged trees have many prerequisite links that skip a column (e.g. Castles -> Metallurgy, with Heraldry in
// between). The tree screen routes such a link through invisible "dummy" waypoints. Vanilla's own trees rarely
// skip columns, and three bugs show up here:
//  1. TreeGrid.generateLayoutData re-points the source card with `connectedNodeTypes.indexOf(from)` (the source
//     looked up in its own list: -1), so `splice(-1, 1)` drops the source's LAST link instead of the rerouted one:
//     links go missing or are drawn to the wrong place. Fix: after the layout step, take each card's links from
//     the layout graph, which holds the correct source -> waypoint -> ... -> target chains.
//  2. Waypoints are placed as if every card were one row tall, but a card with a second level ("Heraldry II")
//     also fills the row below it, so a waypoint there runs hidden behind it. Fix: move such a waypoint one row
//     down when that cell is free.
//  3. tree-line draws a straight leg between two waypoints starting at about half its length (a link skipping
//     two or more columns stops halfway). Fix: start that leg at 0 and draw its full length.
//  4. A level leg from a waypoint into a card is shifted off the card's height (Guilds -> Education). Fix: below.
//  5. Large trees get avoidable crossings: the layout library's ordering pass is a short barycenter sweep, and
//     the tree screen then moves cards off that order (a long link drags its target card to the link's row; a
//     dead-end card snaps to its parent's row). Fix (every horizontal tree: tech, civic and ideology trees):
//     re-order each column with repeated sweeps plus adjacent swaps, keeping the order with the fewest crossings,
//     then place rows so links run as straight as possible while every column keeps that order (this also keeps
//     waypoints clear of two-row cards, which replaces fix 2 there). Every cell gets one height and waypoints a card's
//     height, so a row lines up across columns and links between cards on one row are level.
import { TreeGrid } from '/base-standard/ui/tree-grid/tree-grid.js';
import '/base-standard/ui/tree-grid/tree-line.js';
import { TreeGridDirection } from '/base-standard/ui/tree-grid/tree-support.js';
import { Layout } from '/core/ui/utilities/utilities-layout.js';

// Every grid cell gets the same height (CSS below) and a card overflows into the empty cells under it, so a row is
// at the same height in every column. A card needs 2 cells, a card with a second level 4, a waypoint 2.
const CELL_REM = 2.5;
const CARD_REM = 4.7222222222;  // height of a card's main part (85px at 18px/rem)
const span = (card) => (card && !card.isDummy && card.maxDepth > 1 ? 4 : 2);
const WAYPOINT_WEIGHT = 3;  // pull waypoints harder, so long links come out straight

/** layers[rank] = node ids in order; edges only join adjacent ranks (the layout already split long links). */
function readLayers(g) {
  const layers = [];
  for (const v of g.nodes()) {
    const n = g.node(v);
    (layers[n.rank] ??= []).push(v);
  }
  for (let r = 0; r < layers.length; r++) {
    layers[r] ??= [];
    layers[r].sort((a, b) => g.node(a).order - g.node(b).order);
  }
  return layers;
}

function crossingsBetween(upper, lower, succ) {
  const pos = new Map(lower.map((v, i) => [v, i]));
  const ends = [];
  upper.forEach((u, i) => {
    for (const w of succ(u)) if (pos.has(w)) ends.push([i, pos.get(w)]);
  });
  ends.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0;
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      if (ends[i][0] !== ends[j][0] && ends[j][1] < ends[i][1]) n++;
    }
  }
  return n;
}

function totalCrossings(layers, succ) {
  let n = 0;
  for (let r = 0; r + 1 < layers.length; r++) n += crossingsBetween(layers[r], layers[r + 1], succ);
  return n;
}

/** Re-order every layer to reduce crossings: barycenter sweeps both ways, adjacent swaps, several seeded restarts. */
function reduceCrossings(layers, pred, succ) {
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const copy = (ls) => ls.map((l) => l.slice());
  const sortBy = (layer, ref, nbrs) => {
    const pos = new Map(ref.map((v, i) => [v, i]));
    const key = new Map();
    layer.forEach((v, i) => {
      const ps = nbrs(v).filter((w) => pos.has(w)).map((w) => pos.get(w));
      key.set(v, ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : i);
    });
    const idx = new Map(layer.map((v, i) => [v, i]));
    layer.sort((a, b) => key.get(a) - key.get(b) || idx.get(a) - idx.get(b));
  };
  const local = (ls, r) => (r > 0 ? crossingsBetween(ls[r - 1], ls[r], succ) : 0) + (r + 1 < ls.length ? crossingsBetween(ls[r], ls[r + 1], succ) : 0);
  const transpose = (ls) => {
    let improved = true;
    for (let pass = 0; improved && pass < 20; pass++) {
      improved = false;
      for (let r = 0; r < ls.length; r++) {
        for (let i = 0; i + 1 < ls[r].length; i++) {
          const before = local(ls, r);
          [ls[r][i], ls[r][i + 1]] = [ls[r][i + 1], ls[r][i]];
          if (local(ls, r) < before) improved = true;
          else [ls[r][i], ls[r][i + 1]] = [ls[r][i + 1], ls[r][i]];
        }
      }
    }
  };
  let best = copy(layers), bestCount = totalCrossings(layers, succ);
  for (let restart = 0; restart < 12 && bestCount > 0; restart++) {
    const ls = copy(restart === 0 ? layers : best);
    if (restart > 0) {
      for (const l of ls) for (let i = l.length - 1; i > 0; i--) if (rand() < 0.3) { const j = Math.floor(rand() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    }
    for (let it = 0; it < 12; it++) {
      for (let r = 1; r < ls.length; r++) sortBy(ls[r], ls[r - 1], pred);
      for (let r = ls.length - 2; r >= 0; r--) sortBy(ls[r], ls[r + 1], succ);
      transpose(ls);
      const c = totalCrossings(ls, succ);
      if (c < bestCount) { bestCount = c; best = copy(ls); }
    }
  }
  return { layers: best, crossings: bestCount };
}

/** Weighted isotonic regression (pool adjacent violators): the closest non-decreasing sequence to targets. */
function isotonic(targets, weights) {
  const blocks = [];
  targets.forEach((t, i) => {
    blocks.push({ sum: t * weights[i], w: weights[i], n: 1 });
    while (blocks.length > 1) {
      const a = blocks[blocks.length - 2], b = blocks[blocks.length - 1];
      if (a.sum / a.w <= b.sum / b.w) break;
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, w: a.w + b.w, n: a.n + b.n });
    }
  });
  const out = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.w);
  return out;
}

/** Row for every node: each column keeps its order with room for each card (spanOf), and every node is
 *  pulled toward the rows of the nodes it links to (waypoints harder), so links are as level as the order allows. */
function assignRows(layers, pred, succ, isDummy, spanOf) {
  const tallest = Math.max(...layers.map((l) => l.length));
  const y = new Map();
  const offsets = layers.map((l) => { let o = 0; return l.map((v) => { const at = o; o += spanOf(v); return at; }); });
  layers.forEach((l, r) => l.forEach((v, i) => y.set(v, (tallest - l.length) + offsets[r][i])));
  const settle = (l, off) => {
    const targets = [], weights = [];
    l.forEach((v, i) => {
      const nb = pred(v).concat(succ(v)).filter((w) => y.has(w));
      let sum = 0, w = 0;
      for (const u of nb) {
        const k = isDummy(u) || isDummy(v) ? WAYPOINT_WEIGHT : 1;
        sum += y.get(u) * k; w += k;
      }
      targets.push((w ? sum / w : y.get(v)) - off[i]);
      weights.push(w || 0.01);
    });
    isotonic(targets, weights).forEach((z, i) => y.set(l[i], z + off[i]));
  };
  for (let it = 0; it < 40; it++) {
    for (let r = 0; r < layers.length; r++) settle(layers[r], offsets[r]);
    for (let r = layers.length - 1; r >= 0; r--) settle(layers[r], offsets[r]);
  }
  const rows = new Map();
  for (const l of layers) {
    let next = -Infinity;
    for (const v of l) {
      const r = Math.max(Math.round(y.get(v)), next);
      rows.set(v, r);
      next = r + spanOf(v);
    }
  }
  const min = Math.min(...rows.values());
  for (const [v, r] of rows) rows.set(v, r - min);
  return rows;
}

function relayout(grid) {
  const td = grid._treeData, g = td.graphLayout, cards = td.cards;
  if (grid._direction !== TreeGridDirection.HORIZONTAL || cards.length === 0) return false;
  const pred = (v) => g.predecessors(v) || [], succ = (v) => g.successors(v) || [];
  const byId = new Map(cards.map((c) => [c.isDummy ? c.name : c.nodeType.toString(), c]));
  const before = readLayers(g);
  const { layers, crossings } = reduceCrossings(before, pred, succ);
  layers.forEach((l) => l.forEach((v, i) => (g.node(v).order = i)));
  const rows = assignRows(layers, pred, succ, (v) => !!byId.get(v)?.isDummy, (v) => span(byId.get(v)));
  let maxRow = 0;
  for (const [v, r] of rows) {
    const card = byId.get(v);
    if (!card) continue;
    card.row = td.originRow + r;
    maxRow = Math.max(maxRow, card.row);
  }
  td.rows = Math.max(td.rows, maxRow + 4 + td.extraRows);
  console.log(`cc-tree-links: relayout ${cards.length} cards, crossings ${totalCrossings(before, succ)} -> ${crossings}`);
  return true;
}

if (!document.getElementById("cc-tree-links-css")) {
  const style = document.createElement("style");
  style.id = "cc-tree-links-css";
  style.textContent = `
    .tree-grid-column .tree-grid-card { height: ${CELL_REM}rem; min-height: ${CELL_REM}rem; max-height: ${CELL_REM}rem; align-items: flex-start; overflow: visible; }
    .tree-grid-column .tree-card.dummy { height: ${CARD_REM}rem; min-height: ${CARD_REM}rem; }
`;
  document.head.appendChild(style);
}

if (!TreeGrid.prototype.__ccLinksPatched) {
  const originalLayout = TreeGrid.prototype.generateLayoutData;
  TreeGrid.prototype.generateLayoutData = function (...args) {
    const result = originalLayout.apply(this, args);
    try {
      const g = this._treeData?.graphLayout;
      if (g) {
        const cards = this._treeData.cards;
        for (const card of cards) {
          const id = card.isDummy ? card.name : card.nodeType.toString();
          const succ = g.successors(id);
          if (succ) card.connectedNodeTypes = succ.slice();
        }
        if (!relayout(this)) {
          const at = (r, c) => cards.find((x) => x.row === r && x.column === c);
          for (const d of cards) {
            if (!d.isDummy) continue;
            const above = at(d.row - 1, d.column);
            if (above && !above.isDummy && above.maxDepth > 1 && !at(d.row + 1, d.column)) d.row += 1;
          }
        }
      }
    } catch (e) {
      console.error("cc-tree-links (layout): " + e);
    }
    return result;
  };
  TreeGrid.prototype.__ccLinksPatched = true;
}

const TreeLine = Controls.getDefinition("tree-line")?.createInstance;
if (TreeLine && !TreeLine.prototype.__ccLinksPatched) {
  const originalCreate = TreeLine.prototype.createHorizontalLine;
  TreeLine.prototype.createHorizontalLine = function (...args) {
    const result = originalCreate.apply(this, args);
    try {
      if (this.isFromNodeDummy && this.isToNodeDummy && this.Root.children.length === 1) {
        const nodes = this.getConnectingNodes();
        if (nodes) {
          const { horizontalLength } = this.getHorizontalCalculations(nodes[0], nodes[1]);
          const line = this.Root.children[0];
          line.style.leftPX = 0;
          line.style.widthPX = horizontalLength;
        }
      } else if (this.isFromNodeDummy && !this.isToNodeDummy && this.Root.children.length === 1) {
        // 4. A level leg from a waypoint into a card is drawn at a slightly different height from the leg coming
        //    into that waypoint (cards and waypoints are centred differently), so the two run parallel instead of
        //    joining (Guilds -> Education). Once both legs exist, move this one to the incoming leg's height.
        const root = this.Root;
        requestAnimationFrame(() => {
          try {
            const line = root.children[0];
            // The incoming leg sits in another container of the same tree: search up from this line.
            let incoming = null;
            for (let p = root.parentElement, i = 0; p && !incoming && i < 8; p = p.parentElement, i++) {
              incoming = [...p.querySelectorAll("tree-line")]
                .find((x) => x !== root && x.getAttribute("to") === root.getAttribute("from")) || null;
            }
            if (!line || !incoming || incoming.children.length !== 1) return;
            const dy = incoming.children[0].getBoundingClientRect().top - line.getBoundingClientRect().top;
            if (Math.abs(dy) >= 1 && Math.abs(dy) < Layout.pixelsToScreenPixels(40)) {
              line.style.topPX = (parseFloat(line.style.top) || 0) + dy;
            }
          } catch (e) {
            console.error("cc-tree-links (join): " + e);
          }
        });
      }
    } catch (e) {
      console.error("cc-tree-links (line): " + e);
    }
    return result;
  };
  TreeLine.prototype.__ccLinksPatched = true;
}
