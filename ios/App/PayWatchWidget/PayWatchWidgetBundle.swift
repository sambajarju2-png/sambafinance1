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
        PayWatchWidget()
        PayWatchWidgetControl()
        PayWatchWidgetLiveActivity()
    }
}
