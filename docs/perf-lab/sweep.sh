#!/bin/bash
# usage: sweep.sh <profile> <visit> <rounds> <outfile> variants...
prof=$1; visit=$2; rounds=$3; out=$4; shift 4
: > $out
for r in $(seq 1 $rounds); do for v in "$@"; do SHORT=1 timeout 90 node measure.js $v $prof $visit 1 >> $out 2>/dev/null; done; done
echo DONE >> $out
