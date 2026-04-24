#!/bin/bash
# Run this on your Mac after npx cap add ios

ICONSET="ios/App/App/Assets.xcassets/AppIcon.appiconset"

if [ ! -d "$ICONSET" ]; then
  echo "Error: iOS project not found. Run 'npx cap add ios' first."
  exit 1
fi

# Copy the 1024x1024 icon (iOS uses single icon since Xcode 14)
cp public/app-icon-1024.png "$ICONSET/AppIcon-1024.png"

# Update Contents.json to use single 1024x1024 icon (modern Xcode)
cat > "$ICONSET/Contents.json" << 'JSON'
{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

echo "App icon installed! Rebuild in Xcode (Cmd+R)"
