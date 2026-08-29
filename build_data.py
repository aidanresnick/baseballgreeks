#!/usr/bin/env python3
"""Build site JSON from canonical stuff_xns_{PT}_{season}.csv exports.

Usage: python3 build_data.py /path/to/baseball/output

Emits, under data/:
  meta.json                 pitch types, seasons, per-file row counts
  lb_{PT}_{Y}.json          leaderboard rows [name, id, n, z, velo, delta, gamma,
                            ivb, vegaZ, hb, vegaX]
  players_index.json        [[display_name, id, shard], ...] for search
  players/{shard}.json      {id: {"name": .., "pts": {PT: {year: <same 9-value tail>}}}}

Greeks are the on-manifold zStuff-unit columns — dzStuff/dinput (paper naming):
delta = greekmz_velo (per +1 mph), gamma = gammamz_velo (per +1 mph^2),
vega-z = greekmz_ivb_in, vega-x = greekmz_hb_in (per +1 inch of
conventional IVB/HB, chain-ruled through az/ax with ddz/dIVB = tau^2/t^2).
"""
import csv
import glob
import json
import os
import re
import sys

SHARDS = 24


def display_name(last_first: str) -> str:
    if "," in last_first:
        last, first = last_first.split(",", 1)
        return f"{first.strip()} {last.strip()}"
    return last_first.strip()


def main(src: str) -> None:
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(os.path.join(out_dir, "players"), exist_ok=True)

    files = sorted(glob.glob(os.path.join(src, "stuff_xns_*_20*.csv")))
    if not files:
        sys.exit(f"no stuff_xns files under {src}")

    pts, years = set(), set()
    players = {}          # id -> {"name":, "pts": {pt: {year: row}}}
    counts = {}

    for fp in files:
        m = re.search(r"stuff_xns_([A-Z]+)_(\d{4})\.csv$", fp)
        if not m:
            continue
        pt, year = m.group(1), m.group(2)
        pts.add(pt)
        years.add(year)
        lb = []
        with open(fp) as f:
            for r in csv.DictReader(f):
                pid = int(r["combo"].split("_")[0])
                row = [
                    int(r["n_pt"]),
                    round(float(r["zStuff"]), 3),
                    round(float(r["velo"]), 1),
                    round(float(r["greekmz_velo"]), 3),
                    round(float(r["gammamz_velo"]), 3),
                    round(float(r["ivb_in"]), 1),
                    round(float(r["greekmz_ivb_in"]), 3),
                    round(float(r["hb_in"]), 1),
                    round(float(r["greekmz_hb_in"]), 3),
                ]
                curves = [[float(v) for v in r[c].split(";")]
                          for c in ("curvez_velo", "curvez_ivb", "curvez_hb")]
                name = display_name(r["name"])
                lb.append([name, pid] + row)
                p = players.setdefault(pid, {"name": name, "pts": {}})
                p["pts"].setdefault(pt, {})[year] = row + curves
        lb.sort(key=lambda x: -x[3])
        with open(os.path.join(out_dir, f"lb_{pt}_{year}.json"), "w") as f:
            json.dump(lb, f, separators=(",", ":"))
        counts[f"{pt}_{year}"] = len(lb)

    shards = {s: {} for s in range(SHARDS)}
    index = []
    for pid, p in players.items():
        s = pid % SHARDS
        shards[s][pid] = p
        index.append([p["name"], pid, s])
    index.sort(key=lambda x: x[0].split()[-1])

    for s, blob in shards.items():
        with open(os.path.join(out_dir, "players", f"{s}.json"), "w") as f:
            json.dump(blob, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "players_index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(
            {
                "pts": sorted(pts),
                "years": sorted(years),
                "counts": counts,
                "players": len(players),
                "curve_grid": {"start": -3.0, "step": 0.5, "n": 13},
            },
            f,
            separators=(",", ":"),
        )
    print(f"{len(files)} files -> {len(players)} pitchers, {sum(counts.values())} rows")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "output")
