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
import { TreeGrid } from '/base-standard/ui/tree-grid/tree-grid.js';
import '/base-standard/ui/tree-grid/tree-line.js';
import { Layout } from '/core/ui/utilities/utilities-layout.js';

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
        const at = (r, c) => cards.find((x) => x.row === r && x.column === c);
        for (const d of cards) {
          if (!d.isDummy) continue;
          const above = at(d.row - 1, d.column);
          if (above && !above.isDummy && above.maxDepth > 1 && !at(d.row + 1, d.column)) d.row += 1;
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
