# Round 3: the frozen tunables

Written by freeze3.mjs at 2026-10-31T18:41:27.576Z (`$W/fs2/r3/FROZEN3.json`), before any validation row was drawn. Infinity is written null by JSON (capCands).

| tunable | value |
|---|---|
| `SHAPE_FILL` | `"0"` |
| `SHAPE_CENTRAL` | `"true"` |
| `SHAPE_MODE` | `{"line":"exact","search":"v2"}` |
| `SHAPE_FWD` | `"briefs"` |
| `WPPM_OPT` | `{"fast":true,"pair":true,"axial":true}` |
| `SHAPE_CHECK` | `{"on":true,"z":3.09,"bin":1,"minsep":0.3,"jack":true,"groups":20,"iter":4,"retest":false}` |
| `SHAPE_MINIMA` | `{"on":true,"collect":30,"preLn":0.1,"preDeg":5,"max":6,"kick":0.02,"rounds":10,"gain":0.5,"shift":0,"k":2,"floorLn":0.02,"floorDeg":1,"capDeg":10,"delta":16,"deltaMisfit":25,"keep":30,"kappa":1.2,"capCands":null,"capEvals":6000}` |
| `SHAPE_KEEP` | `{"rule":"lrt","alpha":0.001,"margin":2,"misfit":true,"bic":10,"early":0.5,"record":false}` |
| `SHAPE_FAMILY` | `{"solids":"none","margin":14,"marginMisfit":35,"nest":{"box":3.84,"cyl":5.99,"ball":5.99},"nestMisfit":25}` |
| `SHAPE_ANGLE` | `{"rule":"profile","t":5.99,"kappa":1,"each":false,"record":false,"dMax":40}` |
| `SHAPE_TARGET` | `{"lines":2,"frames":0,"framesFull":2}` |

Engine copy (harness) sha256:

- db.js fa88bd51e0b3200326a8ca0c7db0fb9124839b5f52fa4048a91c5304946ae017
- xrd-broad.js 2fabfe532b6c00902f285406820796d7cceec7ea4634cce725b031e8ef0ba49e
- xrd-cryst.js 3113ecaf59d90c3812f216e789f2c15afd0414e2b0c4329ca47665b567e1d189
- xrd-data.js ac423feb6bad9f7f9a98abcf8d2b479768f1cc04c98d544f47b93a45469c8b82
- xrd-instr.js f43d9f1dafe7a0fa40682f45c6253b290d152792a5bbc96502b25df48ceef8ba
- xrd-math.js d4ee08782447258b8f6f503ffbcca03de3d99badf5408bc593d8c4af7af5725b
- xrd-rietveld.js 0d722944cb24a256bf989656751ccb9e1f832357f3e18600fce27a56c1036a43
- xrd-rv-model.js acaddf044d2199ba6340e91a1474a556419b2a57de339325f83349e5e002a39c
- xrd-sg.js 1441e0a148b0a3e599c165b1cb869389521a4be0c01575ef285452415b9c1aad
- xrd-sizeline.js f7c8b9a9c029ec853f117ff809f4f77dae8c68aee6d2aa411b1c88157bfc3ba5
- xrd-widths.js cea885b2c9bd86ccad6ef99999bad19b2e5eb54ea8903b2edfc2e5e63ee38468

App copy sha256:

- xrd-rietveld.js ca335f81e9768a8c79f981462d627ae3ec01eaf79b1123df0b6196c2517cb3ba
- xrd-broad.js 8e451deae01bf62e7bea3899ff26c14cf8361b1327286f6f419678bd905e40bc
- xrd-sizeline.js f7c8b9a9c029ec853f117ff809f4f77dae8c68aee6d2aa411b1c88157bfc3ba5
- sw.js 5c03d10bff27475ba5520a3dc065b70e10652e60d9f70c0e31a6a30c14787f01
- RIETVELD.md 7ee1837a03ad1b368c59b2e827fce8c4aa419d8adccb915a3f2403edc5edcb55
