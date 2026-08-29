#!/bin/zsh
# Nightly refresh for baseballgreeks.com.
# Pull new Statcast days -> refit xns in a sandbox (canonical output/ untouched)
# -> rebuild site JSON -> push (site auto-deploys via GitHub Pages).
# Scheduled by ~/Library/LaunchAgents/com.baseballgreeks.nightly.plist.
set -euo pipefail

BB=/Users/aidanresnick/Downloads/baseball
SITE=/Users/aidanresnick/baseballgreeks
PY=$BB/.venv/bin/python
LOG=$SITE/logs/nightly.log
mkdir -p $SITE/logs

exec >>$LOG 2>&1
echo "── $(date '+%F %T') nightly update start"

cd $BB

# 1. Determine the gap: day after the last covered date, through yesterday.
last_end=$(ls data/statcast_2*.csv | sed 's/.*_to_//;s/\.csv//' | sort | tail -1)
yesterday=$(date -v-1d +%F)
if [[ "$last_end" > "$yesterday" || "$last_end" == "$yesterday" ]]; then
  echo "data already covers through $last_end — nothing to do"
  exit 0
fi
start=$(date -j -f "%F" -v+1d "$last_end" +%F)

# 2. Pull the new days from Baseball Savant.
echo "pulling $start -> $yesterday"
$PY pull_statcast.py "$start" "$yesterday"
new_file="data/statcast_${start}_to_${yesterday}.csv"
if [[ ! -s $new_file || $(head -2 "$new_file" | wc -l) -lt 2 ]]; then
  echo "no pitches in range (off-day/off-season) — removing empty file"
  rm -f "$new_file"
  exit 0
fi

# 3. Refresh pitcher positions (fetches only ids not seen before), then refit
#    the canonical model in the sandbox (writes nightly_run/output only).
$PY update_pitcher_positions.py
cp -f output/xnk_selection.csv nightly_run/output/
echo "refitting xns model"
( cd nightly_run && ../.venv/bin/python _exp_csw_xns_allpt.py )

# 4. Rebuild site JSON from the nightly outputs.
$PY $SITE/build_data.py $BB/nightly_run/output

# 5. Commit + push only if anything changed.
cd $SITE
git pull --rebase -q origin main
git add data
if git diff --cached --quiet; then
  echo "no changes in site data"
else
  git commit -m "Nightly data refresh through $yesterday"
  git push origin main
  echo "pushed refresh through $yesterday"
fi
echo "── $(date '+%F %T') nightly update done"
