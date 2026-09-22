#!/bin/bash
# Verify that the public tier of the dataset carries none of the fields the
# audience design keeps for members and stewards (see
# github.com/commonshub/chb/docs/audiences.md). Run it against a DATA_DIR
# before publishing a snapshot: ./scripts/verify-no-private-data.sh [DATA_DIR]

DATA_DIR="${1:-${DATA_DIR:-data}}"
echo "🔍 Checking public tiers under $DATA_DIR ..."

SENSITIVE_FIELDS=(
  "billing_details" "shipping" "destination_details" "receipt_email"
  "payment_method_details" "email" "emailHash" "iban" "counterparty" "memo" "fullDescription" "reference" "address"
)

FOUND=0
for field in "${SENSITIVE_FIELDS[@]}"; do
  count=$(grep -rl "\"$field\"" "$DATA_DIR"/*/*/public/ "$DATA_DIR"/*/public/ "$DATA_DIR"/latest/public/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    echo "❌ FAIL: \"$field\" appears in $count public file(s)"
    grep -rl "\"$field\"" "$DATA_DIR"/*/*/public/ "$DATA_DIR"/*/public/ "$DATA_DIR"/latest/public/ 2>/dev/null | head -5
    FOUND=1
  else
    echo "✅ PASS: no \"$field\""
  fi
done

if [ $FOUND -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED - the public tier is clean"
  exit 0
fi
echo "❌ CHECKS FAILED - regenerate with chb (chb generate --force) and re-run"
exit 1
