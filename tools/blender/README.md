# Workshop art (Blender)

Headless Blender scripts that render the logo, the banner and the title card. **Close Civilization VII before
rendering** (both use the GPU heavily).

| Script | Renders |
|---|---|
| `cc_logo_medallion.py` | The logo: a carved plaster medallion cut into a C, a skyline on its rim, the title below (Workshop preview) |
| `cc_banner.py` | `--mode banner`: the city on a gold line with a star; `--mode slogan`: the slogan strip; `--mode card`: the 16:9 title card; `--mode wide`: the slogan over the city, for the top of the Workshop description |
| `cc_kit.py` | Shared helpers: scene setup, materials (incl. photo marble and the sunrise wall glow), simple buildings |
| `cc_building_refs.py` | Each kit building alone on white, as image references for an image-to-3D tool |
| `cc_logo.py`, `cc_logo_base.py` | Earlier all-procedural logo attempts, kept for reference |

## Assets kept outside the repo
The sculpted models and the marble texture are passed by path and are never committed:
- the medallion and five buildings: the author's own Meshy generations (GLB), `--model`, `--castle`, `--tower`,
  `--dome`, `--houses`, `--factory`; without a building GLB the kit's simple version is used;
- the marble: a 4K PBR texture set (`marble_81`), `--marble <folder>` with `--marble-raw`.

## The renders used for 0.2.0
```
blender -b --factory-startup --python tools/blender/cc_logo_medallion.py -- --model <medallion.glb> <buildings> --marble <folder> --marble-raw --marble-size 9 --marble-place 0.06 0.60 180 --sun 4 --out logo.png --size 1536
blender -b --factory-startup --python tools/blender/cc_banner.py -- <buildings> --marble <folder> --marble-raw --marble-place 0.84 0.92 270 --front 0.45 --glow 3 --out banner.png
blender -b --factory-startup --python tools/blender/cc_banner.py -- --mode slogan --marble <folder> --marble-raw --marble-place 0.68 0.54 0 --out slogan.png
blender -b --factory-startup --python tools/blender/cc_banner.py -- --mode card <buildings> --marble <folder> --marble-raw --marble-place 0.22 0.46 270 --front 0.45 --glow 3 --out card.png
```
`--marble-place` (texture offset and rotation) was chosen by scoring placements for the least vein behind the text.
