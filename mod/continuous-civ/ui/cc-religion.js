// Continuous Civilization - the Religion button in a permanent Antiquity (UI side; audit #3).
// Vanilla picks the screen behind the sub-system dock's Religion button and the radial menu's Religion entry from the
// game Age: pantheon screens in Antiquity, religion and belief pickers in Exploration
// (panel-sub-system-dock.js getReligionScreenName, radial-menu-items.js). The game Age never leaves Antiquity here,
// so after founding a religion the button still opened the pantheon screen; only the notification reached the
// religion and belief pickers. This script decides from the player's own religion instead:
//   * religion founded         -> belief picker (shows the religion, adds beliefs)
//   * can found one            -> religion picker
//   * otherwise                -> vanilla's choice (pantheon chooser or pantheon summary)
// Display only: it changes which screen opens, not what the player can do.
import { getRadialMenus } from '/core/ui/radial-menu/radial-menu-item-store.js';
import { unwrap } from '/core/vendor/solid-js/store/dist/store.js';

/** The religion screen for the local player's own state, or null to keep vanilla's choice. */
function religionScreen() {
  const religion = Players.get(GameContext.localPlayerID)?.Religion;
  if (!religion) return null;
  if (religion.hasCreatedReligion()) return "panel-belief-picker";
  if (religion.canCreateReligion()) return "panel-religion-picker";
  return null;
}

/** Wrap the dock's getReligionScreenName on its class, once the dock is defined. */
function patchDock() {
  const proto = Controls.getDefinition?.("panel-sub-system-dock")?.createInstance?.prototype;
  if (!proto || typeof proto.getReligionScreenName != "function") return false;
  if (!proto.__ccReligion) {
    const base = proto.getReligionScreenName;
    proto.getReligionScreenName = function () { return religionScreen() ?? base.call(this); };
    Object.defineProperty(proto, "__ccReligion", { value: true });
  }
  return true;
}

/** Wrap the radial menu's Religion entry (registered with the RADIAL_RELIGION icon). */
function patchRadial() {
  for (const menu of unwrap(getRadialMenus())) {
    for (const item of menu.items ?? []) {
      if (item.icon1 != "RADIAL_RELIGION" || !item.navigation || item.navigation.__ccReligion) continue;
      const base = item.navigation.value;
      item.navigation.value = () => religionScreen() ?? base();
      Object.defineProperty(item.navigation, "__ccReligion", { value: true });
      return true;
    }
  }
  return false;
}

// The dock and the radial menu register their parts as their own scripts load; retry until both are patched.
let tries = 0;
const timer = setInterval(() => {
  const dock = patchDock();
  const radial = patchRadial();
  if ((dock && radial) || ++tries > 120) clearInterval(timer);
}, 500);
