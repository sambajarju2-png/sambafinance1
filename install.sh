#!/bin/bash
# PayWatch AI Corrections — Install Script
# Run from the sambafinance1 root directory

echo "🔧 Installing AI correction system..."

# 1. Patch bills.ts: rename incasso_kosten → incasso
if grep -q "incasso_kosten" src/lib/bills.ts; then
  sed -i '' "s/'incasso_kosten'/'incasso'/" src/lib/bills.ts
  echo "✅ bills.ts: incasso_kosten → incasso"
else
  echo "⏭️  bills.ts: already updated (no incasso_kosten found)"
fi

# 2. Verify overheid is present
if grep -q "'overheid'" src/lib/bills.ts; then
  echo "✅ bills.ts: overheid category present"
else
  # Add overheid after telecom
  sed -i '' "s/'telecom',/'telecom',\n  'overheid',/" src/lib/bills.ts
  echo "✅ bills.ts: added overheid category"
fi

echo ""
echo "📦 All files installed. Now run:"
echo "   git add ."
echo "   git commit -m 'Feature: AI correction tracking + Dutch extraction rules'"
echo "   git push origin main"
