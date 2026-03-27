#!/bin/bash
# PayWatch Payment Confirmation — Install Script
# Run from sambafinance1 root

echo "🔧 Installing payment confirmation feature..."

# Add confirmation_image_url to Bill interface if not present
if grep -q "confirmation_image_url" src/lib/bills.ts; then
  echo "⏭️  bills.ts: confirmation_image_url already present"
else
  # Add it after payment_url
  if grep -q "payment_url" src/lib/bills.ts; then
    sed -i '' '/payment_url/a\
  confirmation_image_url: string | null;
' src/lib/bills.ts
    echo "✅ bills.ts: added confirmation_image_url to Bill interface"
  else
    # Fallback: add after notes
    sed -i '' '/notes:/a\
  confirmation_image_url: string | null;
' src/lib/bills.ts
    echo "✅ bills.ts: added confirmation_image_url to Bill interface (after notes)"
  fi
fi

echo ""
echo "📦 All files installed. Now run:"
echo "   git add ."
echo "   git commit -m 'Feature: payment confirmation image vault'"
echo "   git push origin main"
