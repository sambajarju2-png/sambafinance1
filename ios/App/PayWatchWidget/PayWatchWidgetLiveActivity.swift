//
//  PayWatchWidgetLiveActivity.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct PayWatchWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct PayWatchWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PayWatchWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension PayWatchWidgetAttributes {
    fileprivate static var preview: PayWatchWidgetAttributes {
        PayWatchWidgetAttributes(name: "World")
    }
}

extension PayWatchWidgetAttributes.ContentState {
    fileprivate static var smiley: PayWatchWidgetAttributes.ContentState {
        PayWatchWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: PayWatchWidgetAttributes.ContentState {
         PayWatchWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: PayWatchWidgetAttributes.preview) {
   PayWatchWidgetLiveActivity()
} contentStates: {
    PayWatchWidgetAttributes.ContentState.smiley
    PayWatchWidgetAttributes.ContentState.starEyes
}
