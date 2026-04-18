#!/usr/bin/env bash
set +e
mkdir -p tmp/test-runs
scripts=$(ls scripts/test-level*-*cases.sh 2>/dev/null | sort -V)
if [ -z "$scripts" ]; then
  echo "NO_TEST_SCRIPTS_FOUND"
  exit 1
fi
pass=0
fail=0
for s in $scripts; do
  name=$(basename "$s")
  log="tmp/test-runs/${name}.log"
  echo "===== RUN $s ====="
  start=$(date +%s)
  bash "$s" >"$log" 2>&1
  rc=$?
  end=$(date +%s)
  dur=$((end-start))
  if [ $rc -eq 0 ]; then
    status="PASS"
    pass=$((pass+1))
  else
    status="FAIL"
    fail=$((fail+1))
  fi
  echo "RESULT|$name|$status|rc=$rc|dur=${dur}s|log=$log"

  summary_line=$(grep -n "SUMMARY" "$log" | tail -n1 | cut -d: -f1)
  if [ -n "$summary_line" ]; then
    from=$((summary_line-2))
    if [ $from -lt 1 ]; then from=1; fi
    to=$((summary_line+6))
    sed -n "${from},${to}p" "$log" | sed "s/^/  /"
  else
    tail -n 12 "$log" | sed "s/^/  /"
  fi
  echo
done

echo "===== OVERALL ====="
total=$(echo "$scripts" | wc -w | tr -d " ")
echo "TOTAL=$total PASS=$pass FAIL=$fail"
if [ $fail -gt 0 ]; then
  exit 1
fi
exit 0
