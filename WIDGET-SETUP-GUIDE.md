# PayWatch iOS Widget Extension — Setup Guide

## What you're getting

| File | Where it goes | Purpose |
|------|---------------|---------|
| `WidgetBridgePlugin.swift` | `ios/App/App/Plugins/` | Capacitor plugin (JS → native bridge) |
| `PayWatchWidgetBundle.swift` | `ios/App/PayWatchWidget/` | Widget extension entry point |
| `PayWatchWidget.swift` | `ios/App/PayWatchWidget/` | TimelineProvider + view router |
| `WidgetData.swift` | `ios/App/PayWatchWidget/Models/` | Codable data model + placeholder |
| `WidgetFormatters.swift` | `ios/App/PayWatchWidget/Helpers/` | Dutch currency/date formatting |
| `SmallWidgetView.swift` | `ios/App/PayWatchWidget/WidgetViews/` | Home Screen small (2×2) |
| `MediumWidgetView.swift` | `ios/App/PayWatchWidget/WidgetViews/` | Home Screen medium (4×2) |
| `LockScreenWidgetView.swift` | `ios/App/PayWatchWidget/WidgetViews/` | Lock Screen (rectangular + circular + inline) |
| `widget-bridge.ts` | `src/lib/` | TypeScript wrapper for calling the plugin |

## What ships in MVP

**Home Screen:**
- `.systemSmall` — Next bill: vendor, amount, countdown, overdue badge
- `.systemMedium` — KPI row (outstanding + overdue) + next bill detail

**Lock Screen:**
- `.accessoryRectangular` — Overdue alert or next bill one-liner
- `.accessoryCircular` — Overdue/upcoming count
- `.accessoryInline` — Single-line status text

---

## Xcode Setup (manual steps)

### 1. Open the Xcode project

```bash
cd sambafinance1
open ios/App/App.xcodeproj
```

### 2. Create the Widget Extension target

1. In Xcode: **File → New → Target**
2. Search for **Widget Extension**
3. Product Name: `PayWatchWidget`
4. Check **"Include Configuration App Intent"** (for iOS 17+ interactive widgets later)
5. Language: Swift
6. Click **Finish**
7. When prompted "Activate PayWatchWidget scheme?" → click **Activate**

### 3. Set up App Groups on BOTH targets

**Main app target** (`App`):
1. Select the **App** target in the project navigator
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability** → search **App Groups**
4. Click **+** and enter: `group.nl.paywatch.app`

**Widget target** (`PayWatchWidgetExtension`):
1. Select the **PayWatchWidgetExtension** target
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability** → search **App Groups**
4. Click **+** and enter: `group.nl.paywatch.app` (same identifier!)

### 4. Set deployment target

Both targets must have the same minimum deployment target:
- Main app: iOS 16.0 (or whatever you currently have)
- Widget: iOS 16.0 (required for Lock Screen widgets)

### 5. Copy the Swift files

**Capacitor plugin** → copy into `ios/App/App/Plugins/`:
```
ios/App/App/Plugins/WidgetBridgePlugin.swift
```

**Widget extension** → copy into the `PayWatchWidget` group that Xcode created:
```
ios/App/PayWatchWidget/
├── PayWatchWidgetBundle.swift    (replace Xcode's generated file)
├── PayWatchWidget.swift          (replace Xcode's generated file)
├── Models/
│   └── WidgetData.swift
├── Helpers/
│   └── WidgetFormatters.swift
└── WidgetViews/
    ├── SmallWidgetView.swift
    ├── MediumWidgetView.swift
    └── LockScreenWidgetView.swift
```

**Important:** When adding files in Xcode, make sure each file's **Target Membership** is set to **PayWatchWidgetExtension** (not the main App target). The exception is `WidgetBridgePlugin.swift` which belongs to the **App** target.

### 6. Delete Xcode's auto-generated widget files

When you created the Widget Extension target, Xcode generated some template files. Delete these (they're replaced by your custom files):
- The default `PayWatchWidget.swift` (or whatever Xcode named it)
- The default `PayWatchWidgetBundle.swift`
- Any `ContentView.swift` or `AppIntent.swift` in the widget group

### 7. Register the Capacitor plugin

Open `ios/App/App/AppDelegate.swift` and add the plugin registration.

If there's already a `application(_:didFinishLaunchingWithOptions:)` method, add to it. Otherwise:

```swift
import Capacitor

// In the AppDelegate class, add:
override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Register widget bridge plugin
    bridge?.registerPluginInstance(WidgetBridgePlugin())
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
}
```

**Note:** Depending on your Capacitor version, you may need to register differently. If the above doesn't compile, check if your AppDelegate uses `CAPBridgeViewController` — in that case the plugin auto-registers via `CAPBridgedPlugin` conformance.

### 8. Copy the TypeScript file

```bash
cp widget-bridge.ts src/lib/widget-bridge.ts
```

---

## Integration (ALREADY DONE — in repo)

### Dashboard sync (overzicht/page.tsx)
`syncWidgetFromBills(fresh)` is called after every bill fetch. It also fetches
`/api/finances/overview` to enrich the widget with income/expenses/disposable data.

### Logout cleanup (sign-out-button.tsx)
`clearWidget()` is called before `supabase.auth.signOut()` to wipe sensitive data.

### Auth token for background refresh (overzicht/page.tsx)
`storeWidgetAuth(accessToken)` stores the Supabase JWT in App Groups so the
`BGAppRefreshTask` can fetch fresh data when the app is closed.

### Background refresh (/api/widget/data)
Server endpoint that accepts `Authorization: Bearer <token>` and returns the
full widget payload. Called by the native `BGAppRefreshTask` every 30 minutes.

---

## Testing

### Simulator
1. Build and run the **main app** first (to populate App Groups)
2. Switch to the **PayWatchWidgetExtension** scheme
3. Run → it will ask which widget size to preview
4. For Lock Screen testing: long-press Lock Screen in simulator → customize

### Device
- Widgets in simulator can behave differently than real devices
- Test dark mode, StandBy mode, and `.privacySensitive()` redaction
- Verify deep link (`nl.paywatch.app://overzicht`) opens the correct screen

### Developer mode
In Xcode → Product → Scheme → Edit Scheme → Run → Arguments:
Add `-com.apple.WidgetKit.debug.enable-timeline-debug 1` to bypass system timeline budgets during development.

---

## Architecture Notes

- **No network calls in the widget.** All data comes from the web app via App Groups.
- **30-minute refresh policy.** Widget only updates when: (a) the app writes new data, or (b) the 30-minute timer fires and re-reads cached data.
- **Privacy:** `.privacySensitive()` on all amount fields — iOS auto-redacts when the device is locked.
- **Offline-first:** Widget shows last cached data. If no data exists, shows "Open PayWatch om te beginnen."
- **Deep linking:** All widget taps open `nl.paywatch.app://overzicht` in the Capacitor app.

---

## Phase 2 (BUILT — in repo)

- `.systemLarge` — Bill list with interactive "Betaald" buttons + financial overview + debt countdown
- Configurable widget mode — long-press → Edit → "Rekeningen" or "Financieel"
- `BudgetMediumWidgetView` — Alternate medium view with income/expenses/vrij besteedbaar
- Interactive "Betaald" button via `MarkBillAsPaidIntent` (iOS 17+)
- Control Center shortcuts (iOS 18+): "Scan Rekening" + "PayWatch Status"
- `BGAppRefreshTask` — Background data refresh every 30 min via `/api/widget/data`
- Live Activity stub — Dynamic Island for payment tracking (structure ready)

## Phase 3 (future)

- Live Activity for bill payment flow (processing → completed → failed)
- Apple Watch complication (if watchOS app is added)
- Widget suggestions via Siri Shortcuts integration
- Smart Stack relevance scoring (show widget when bills are due)
