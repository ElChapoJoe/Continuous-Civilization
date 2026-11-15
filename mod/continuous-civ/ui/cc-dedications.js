// Continuous Civilization - Dedications tree (UI side).
// data/83-dedications.sql makes each Dedication card an attribute-tree node (CC_DED_<card>). The engine lets any
// node be bought with points; the card's effects only apply once one of its Triumphs is complete and its Age is
// reached. So the buy check is narrowed here: a Dedication node can only be bought when that is already true, and
// the screen shows it locked otherwise. Display/validation for the local player only; the AI gets no Dedication
// points (it receives earned Dedications automatically).
// Personal Age uses the same root techs as data/70-personal-age.sql.

function rootHashes(setId) {
  const out = [];
  for (const row of GameInfo.RequirementSetRequirements) {
    if (row.RequirementSetId !== setId) continue;
    const arg = GameInfo.RequirementArguments.find(
      (a) => a.RequirementId === row.RequirementId && a.Name === "ProgressionTreeNodeType");
    const node = arg && GameInfo.ProgressionTreeNodes.lookup(arg.Value);
    if (node) out.push(node.$hash);
  }
  return out;
}
const dedExploration = rootHashes("CC_REQSET_PERSONAL_AGE_EXPLORATION");
const dedModern = rootHashes("CC_REQSET_PERSONAL_AGE_MODERN");

// Node index -> { triumphs (type names), needsModern }
const dedNodes = new Map();
for (const node of GameInfo.ProgressionTreeNodes) {
  if (!node.ProgressionTreeNodeType.startsWith("CC_DED_")) continue;
  const card = node.ProgressionTreeNodeType.slice("CC_DED_".length);
  const arg = GameInfo.RequirementArguments.find(
    (a) => a.RequirementId === "CC_REQ_DED_TRIUMPH_" + card && a.Name === "TriumphTypes");
  const ageReq = GameInfo.RequirementSetRequirements.find(
    (r) => r.RequirementSetId === "CC_REQSET_DED_" + card && /^CC_REQ_IN_/.test(r.RequirementId));
  dedNodes.set(node.$index, {
    triumphs: arg ? arg.Value.split(",").map((s) => s.trim()) : [],
    needsModern: ageReq?.RequirementId === "CC_REQ_IN_MODERN",
  });
}

function qualifies(playerId, info) {
  const player = Players.get(playerId);
  if (!player) return false;
  const roots = info.needsModern ? dedModern : dedExploration.concat(dedModern);
  if (!roots.some((h) => player.Techs?.isNodeUnlocked(h))) return false;
  return info.triumphs.some((t) => {
    const def = GameInfo.Legacies.lookup(t);
    return def && player.Legacies?.isTriggered(def.$hash);
  });
}

// Shared with ui/cc-dedication-popup.js: the Dedications a player can take now (qualifying, not yet taken).
globalThis.CCDedications = {
  available(playerId) {
    const player = Players.get(playerId);
    const out = [];
    if (!player) return out;
    for (const [index, info] of dedNodes) {
      if (!qualifies(playerId, info)) continue;
      const node = GameInfo.ProgressionTreeNodes[index] ?? GameInfo.ProgressionTreeNodes.find((n) => n.$index === index);
      if (!node || Game.ProgressionTrees.getNodeState(playerId, node.$hash) >= ProgressionTreeNodeState.NODE_STATE_UNLOCKED) continue;
      const earned = info.triumphs.map((t) => GameInfo.Legacies.lookup(t)).find((d) => d && player.Legacies?.isTriggered(d.$hash));
      out.push({ index, name: node.Name, description: node.Description, triumphName: earned ? earned.Name : node.Name });
    }
    return out;
  },
};

(function install() {
  const ops = Game.PlayerOperations;
  if (ops.__ccDedications) return;
  const original = ops.__ccOriginalCanStart || ops.canStart;
  ops.__ccOriginalCanStart = original;
  ops.canStart = function (playerId, operation, args, flag) {
    const result = original.call(ops, playerId, operation, args, flag);
    try {
      if (operation === PlayerOperationTypes.BUY_ATTRIBUTE_TREE_NODE && result?.Success && args) {
        const info = dedNodes.get(+args.ProgressionTreeNodeType);
        if (info && !qualifies(playerId, info)) return Object.assign({}, result, { Success: false });
      }
    } catch (e) {
      console.error("cc-dedications: " + e);
    }
    return result;
  };
  ops.__ccDedications = true;
})();

// The AI gets no Dedication points, but it can spend Wildcard attribute points on Dedication nodes, whose effects are
// for human players only (the AI gets its Dedications from data/83-dedications.sql's AI copies). Give each such point
// back so it goes to a real attribute node. Each node can only be bought once, so this ends.
const dedicationAttribute = GameInfo.Attributes.lookup("ATTRIBUTE_CC_DEDICATION")?.$hash;
engine.on("AttributeNodeCompleted", (data) => {
  try {
    if (data?.attribute !== dedicationAttribute) return;
    const player = Players.get(data.player);
    if (!player || player.isHuman) return;
    player.Identity.addWildcardAttributePoints(1);
  } catch (e) {
    console.error("cc-dedications: " + e);
  }
});
