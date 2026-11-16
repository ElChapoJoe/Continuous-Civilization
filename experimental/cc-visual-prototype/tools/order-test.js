// Build-order test for the street-pattern seed (debug console, TEST SAVES ONLY: this changes the game state).
// Places one Antiquity building on each of two free tiles of the first city, in the given order, a few seconds
// apart, so the engine creates two new urban districts. Measure their street patterns afterwards with
// street-probe.js and compare runs from the same save (same order twice, then the other order).
//   CCOrderTest.run([[x1, y1, "BUILDING_..."], [x2, y2, "BUILDING_..."]])   CCOrderTest.status()
(function () {
  let log = [];
  function place(x, y, type) {
    const me = GameContext.localPlayerID;
    const city = Players.get(me).Cities.getCities()[0];
    const def = GameInfo.Constructibles.lookup(type);
    Game.PlayerOperations.sendRequest(me, "CREATE_ELEMENT",
      { Kind: "CONSTRUCTIBLE", Type: def.$index, Location: { x, y }, Parent: city.id, Owner: me });
    log.push(`placed ${type} at ${x},${y}`);
  }
  function run(steps, gapMs = 4000) {
    log = [];
    steps.forEach(([x, y, type], i) => setTimeout(() => place(x, y, type), i * gapMs));
    return "running " + steps.length + " steps";
  }
  function status() {
    const out = [...log];
    for (const p of [[32, 10], [32, 9]]) {
      const d = Districts.getAtLocation({ x: p[0], y: p[1] });
      out.push(`${p[0]},${p[1]}: ` + (d ? `district ${d.id.id} cons ${d.getConstructibleIds().map((c) => c.id).join("/")}` : "no district"));
    }
    return out.join(" | ");
  }
  globalThis.CCOrderTest = { run, status };
  return "CCOrderTest ready";
})();
