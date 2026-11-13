# Steam Workshop upload

Everything the Workshop item needs, kept with the mod so updates stay consistent.

| Field | Value |
|---|---|
| Mod folder to upload | `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\continuous-civ` (run `tools/deploy.ps1` first so it matches `main`) |
| Title | `Continuous Civilization (Beta)` |
| Preview image | [`docs/images/workshop-preview.jpg`](../images/workshop-preview.jpg) (1024 x 1024, under Steam's 1 MB limit) |
| Description | [`description.txt`](description.txt), in Steam's formatting codes (paste it as is) |
| Extra screenshots | `docs/images/tech-tree.jpg`, `docs/images/tech-tree-exploration.jpg`, `docs/images/empire.jpg` |
| Visibility | **Unlisted** for the closed beta (only people with the link see it), **Public** when it opens up |
| Change note (first upload) | `0.1.0-beta: first public beta.` |

## First upload
1. In Steam, open **Library**, switch the filter to **Tools**, and install **Sid Meier's Civilization VII Development Tools**.
2. Run `tools/deploy.ps1` so the Mods folder copy matches `main`.
3. Start the **Mod Uploader** from the development tools.
4. Point it at the mod folder above, then fill in the title, description, preview image and visibility from the table.
5. Upload, then open the item's page on Steam to check the description and add the extra screenshots.

## Updates
- Bump `version` in `continuous-civ.modinfo` and add a `CHANGELOG.md` entry.
- Deploy, then upload to the **same** Workshop item, with the changelog entry as the change note.
- Subscribers get the update automatically; remind testers to start a new game.
