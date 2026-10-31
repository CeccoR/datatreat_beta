# Step 4: directions, each axis alone and as unordered sets (`../STEP4.md` §8)

`dirs4.mjs --tag S2 --rows`.

| axes | n | covered, each alone | covered, set rule | median error ° alone / set | beyond 10° alone / set | in a set | in a set: covered alone / set | in a set: median error / | median radius alone / set |
|---|---|---|---|---|---|---|---|---|---|
| all | 144 | 105 | 106 | 2.0 / 2.2 | 29 / 29 | 24 | 17 / 18 | 2.0 / 2.2 | 3.3 / 4.3 |
| box, square box | 66 | 46 | 47 | 2.0 / 2.2 | 13 / 13 | 24 | 17 / 18 | 2.0 / 2.2 | 3.3 / 4.3 |
| clean | 69 | 61 | 63 | 1.4 / 1.4 | 8 / 8 | 14 | 12 / 14 | 2.0 / 2.2 | 2.9 / 4.2 |
| resolved (esd ≤ 30°) | 137 | 99 | 100 | 1.9 / 2.2 | 26 / 26 | 24 | 17 / 18 | 2.0 / 2.2 | 3.3 / 4.3 |

| row | axis | set | error alone / set ° | radius alone / set ° |
|---|---|---|---|---|
| box-Pmmm-on | 0 |  | 4.2 / 4.2 | 0.6 / 0.6 |
| box-Pmmm-on | 2 |  | 3.0 / 3.0 | 0.9 / 0.9 |
| box-Pmmm-on | 1 |  | 4.4 / 4.4 | 0.8 / 0.8 |
| box-P6m-generic | 2 |  | 59.2 / 12.6 | 12.1 / 12.1 |
| box-P6m-generic | 0 | yes | 22.7 / 24.2 | 28.7 / 28.7 |
| box-P6m-generic | 1 | yes | 54.7 / 24.2 | 28.7 / 28.7 |
| box-P6mmm-on | 0 |  | 5.3 / 5.3 | 3.4 / 3.4 |
| box-P6mmm-on | 2 |  | 3.3 / 3.3 | 2.4 / 2.4 |
| box-P6mmm-on | 1 |  | 4.5 / 4.5 | 3.5 / 3.5 |
| box-Pm-3-near | 1 |  | 6.8 / 6.8 | 6.4 / 6.4 |
| box-Pm-3-near | 2 |  | 8.5 / 8.5 | 5.1 / 5.1 |
| box-Pm-3m-generic | 0 |  | 4.7 / 4.7 | 4.1 / 4.1 |
| sqbox-P-1-on | 1 | yes | 1.7 / 1.8 | 1.0 / 1.2 |
| sqbox-P-1-on | 0 | yes | 1.8 / 1.8 | 1.3 / 1.2 |
| sqbox-P2m-near | 1 | yes | 0.3 / 0.5 | 0.5 / 0.6 |
| sqbox-P2m-near | 0 | yes | 0.5 / 0.5 | 0.7 / 0.6 |
| sqbox-Pmmm-generic | 1 | yes | 7.2 / 7.2 | 44.7 / 44.7 |
| sqbox-Pmmm-generic | 0 | yes | 5.0 / 7.2 | 37.5 / 44.7 |
| sqbox-P4m-on | 0 | yes | 90.0 / 90.0 | 77.8 / 77.8 |
| sqbox-P4m-on | 1 | yes | 15.1 / 90.0 | 15.1 / 77.8 |
| sqbox-P4m-on | 2 |  | 90.0 / 90.0 | 77.3 / 77.3 |
| sqbox-P4mmm-near | 0 | yes | 2.1 / 2.2 | 2.1 / 2.9 |
| sqbox-P4mmm-near | 1 | yes | 2.2 / 2.2 | 2.2 / 2.9 |
| sqbox-P-3-generic | 1 | yes | 2.7 / 2.7 | 3.9 / 4.4 |
| sqbox-P-3-generic | 0 | yes | 1.4 / 2.7 | 3.4 / 4.4 |
| sqbox-P-3-generic | 2 |  | 2.9 / 2.9 | 2.7 / 2.7 |
| sqbox-P-3m1-on | 0 | yes | 13.2 / 24.0 | 13.9 / 13.9 |
| sqbox-P-3m1-on | 1 | yes | 24.0 / 24.0 | 13.2 / 13.9 |
| sqbox-P-3m1-on | 2 |  | 20.2 / 20.2 | 4.3 / 4.3 |
| sqbox-P6m-near | 0 | yes | 1.9 / 1.9 | 2.7 / 6.4 |
| sqbox-P6m-near | 1 | yes | 1.4 / 1.9 | 6.4 / 6.4 |
| sqbox-P6mmm-generic | 0 | yes | 0.8 / 0.8 | 3.2 / 3.1 |
| sqbox-P6mmm-generic | 1 | yes | 0.5 / 0.8 | 2.7 / 3.1 |
| sqbox-Pm-3-on | 0 | yes | 0.0 / 0.0 | 1.5 / 1.1 |
| sqbox-Pm-3-on | 1 | yes | 0.0 / 0.0 | 1.6 / 1.1 |
| sqbox-Pm-3m-near | 0 | yes | 2.3 / 2.3 | 3.7 / 4.2 |
| sqbox-Pm-3m-near | 1 | yes | 1.9 / 2.3 | 3.1 / 4.2 |
| ellcyl-P-1-near | 0 |  | 82.3 / 82.3 | 3.1 / 3.1 |
| ellcyl-P4m-near | 1 |  | 1.2 / 1.2 | 0.6 / 0.6 |
| ellcyl-P4m-near | 0 |  | 2.8 / 2.8 | 0.6 / 0.6 |
| ellcyl-P4m-near | 2 |  | 3.0 / 3.0 | 0.8 / 0.8 |
| ellcyl-P-3m1-near | 1 |  | 25.1 / 25.1 | 4.3 / 4.3 |
| ellcyl-P-3m1-near | 0 |  | 5.2 / 5.2 | 4.1 / 4.1 |
| ellcyl-P-3m1-near | 2 |  | 25.6 / 25.6 | 2.3 / 2.3 |
| ellipsoid-Pmmm-generic | 1 |  | 0.9 / 0.9 | 0.7 / 0.7 |
| ellipsoid-P4mmm-near | 0 |  | 14.0 / 14.0 | 0.6 / 0.6 |
| ellipsoid-P4mmm-near | 2 |  | 14.5 / 14.5 | 3.0 / 3.0 |
| ellipsoid-P4mmm-near | 1 |  | 8.9 / 8.9 | 3.1 / 3.1 |
| ellipsoid-P-3-generic | 2 |  | 14.8 / 14.8 | 12.4 / 12.4 |
| ellipsoid-P-3-generic | 0 |  | 14.5 / 14.5 | 11.2 / 11.2 |
| ellipsoid-P6m-near | 2 |  | 19.0 / 19.0 | 16.6 / 16.6 |
| ellipsoid-P6m-near | 0 |  | 19.0 / 19.0 | 6.4 / 6.4 |
| ellipsoid-Pm-3m-near | 0 |  | 3.6 / 3.6 | 1.4 / 1.4 |
| spheroid-P-1-generic | 2 |  | 88.0 / 88.0 | 1.3 / 1.3 |
| spheroid-P6m-on | 2 |  | 28.5 / 28.5 | 17.8 / 17.8 |
| spheroid-Pm-3-generic | 2 |  | 6.0 / 6.0 | 3.9 / 3.9 |
