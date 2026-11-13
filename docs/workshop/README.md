# Steam Workshop upload

Everything the Workshop item needs, kept with the mod so updates stay consistent.

| Field | Value |
|---|---|
| Mod folder to upload | `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\continuous-civ` (run `tools/deploy.ps1` first so it matches `main`) |
| Title | `Continuous Civilization (Beta)` |
| Preview image | [`docs/images/workshop-preview.jpg`](../images/workshop-preview.jpg): the logo, a gold C in a laurel wreath (1024 x 1024, under Steam's 1 MB limit). Drawn by `tools/make_logo.py` and `tools/render_logo.ps1`; `docs/images/logo.svg` is the scalable version |
| Description | [`description.txt`](description.txt), in Steam's formatting codes (paste it as is) |
| Extra screenshots | `docs/images/tech-tree.jpg`, `docs/images/tech-tree-exploration.jpg`, `docs/images/empire.jpg` |
| Visibility | The uploader offers Public, Friends Only and Private. **Friends Only** for a closed beta with Steam friends, **Public** to open it up (visibility can be changed later on the item's Steam page) |
| Change note (first upload) | `0.1.0-beta: first public beta.` |

## First upload
1. In Steam, open **Library**, switch the filter to **Tools**, and install **Sid Meier's Civilization VII Development Tools**.
2. Run `tools/deploy.ps1` so the Mods folder copy matches `main`.
3. Run `python -I tools/workshop_placeholders.py`. The uploader checks that every file the `.modinfo` lists exists inside the mod folder, but it doesn't understand references to the game's own files (`{age-exploration}data/...`), so it reports "Mod references files that are missing". The script adds empty placeholders at those paths; the game ignores them and still loads the real files from the player's install (verified: all test suites pass with them in place). `deploy.ps1` removes them again, so run this after every deploy.
4. Start the **Mod Uploader** from the development tools.
5. Point it at the mod folder above, then fill in the title, description, preview image and visibility from the table.
6. Upload, then open the item's page on Steam to check the description and add the extra screenshots.

## Updates
- Bump `version` in `continuous-civ.modinfo` and add a `CHANGELOG.md` entry.
- Update the main `README.md` first (it is the source of truth), then bring `description.txt` in line: same tagline, features, victory targets and limitations, in Steam's formatting codes and kept shorter.
- Deploy, run `tools/workshop_placeholders.py`, then upload to the **same** Workshop item, with the changelog entry as the change note.
- Subscribers get the update automatically; remind testers to start a new game.
