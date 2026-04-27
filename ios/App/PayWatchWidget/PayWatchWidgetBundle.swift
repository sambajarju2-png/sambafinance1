//
//  PayWatchWidgetBundle.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import WidgetKit
import SwiftUI

@main
struct PayWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Home Screen + Lock Screen widget (configurable: Bills or Budget)
        PayWatchWidget()

        // Live Activity for payment tracking (future)
        PayWatchWidgetLiveActivity()
    }
}
