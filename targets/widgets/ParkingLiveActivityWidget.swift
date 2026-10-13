import ActivityKit
import WidgetKit
import SwiftUI

public struct ParkingLiveActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: ParkingActivityAttributes.self) { context in
            // Lock Screen and Home Screen Banner View
            LockScreenLiveActivityView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 5) {
                            Circle()
                                .fill(context.state.isWarning ? Color.orange : Color.green)
                                .frame(width: 7, height: 7)
                            Text("PARKZONE")
                                .font(.system(size: 9.5, weight: .heavy))
                                .foregroundColor(.gray)
                        }

                        HStack(spacing: 4) {
                            Image(systemName: "location.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.green)
                            Text("Spot \(context.attributes.bayNumber)")
                                .font(.system(size: 16, weight: .black))
                                .foregroundColor(.white)
                        }

                        Text(context.attributes.locationName)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                    }
                    .padding(.leading, 8)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                            .font(.system(size: 17, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(context.state.isWarning ? .orange : .green)

                        HStack(spacing: 3) {
                            Image(systemName: "clock")
                                .font(.system(size: 10))
                                .foregroundColor(.gray)
                            Text("remaining")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.trailing, 8)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        // Native Smooth Progress Bar
                        ProgressView(value: context.state.progressPercent, total: 100.0)
                            .progressViewStyle(LinearProgressViewStyle(tint: context.state.isWarning ? Color.orange : Color.green))
                            .background(Color.white.opacity(0.12))
                            .clipShape(Capsule())
                            .frame(height: 4)

                        HStack {
                            HStack(spacing: 4) {
                                Image(systemName: "car.side.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                                Text(context.attributes.plate)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white.opacity(0.85))
                            }

                            Spacer()

                            Text("Session Active")
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundColor(.green)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.top, 4)
                }
            } compactLeading: {
                // Compact Leading: Left of the hardware camera cutout
                HStack(spacing: 4) {
                    Circle()
                        .fill(context.state.isWarning ? Color.orange : Color.green)
                        .frame(width: 6, height: 6)
                    Image(systemName: "car.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.green)
                    Text(context.attributes.bayNumber)
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundColor(.white)
                }
                .padding(.leading, 4)
            } compactTrailing: {
                // Compact Trailing: Right of the hardware camera cutout
                HStack(spacing: 2) {
                    Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(context.state.isWarning ? .orange : .white)
                    Image(systemName: "clock")
                        .font(.system(size: 9))
                        .foregroundColor(.gray)
                }
                .padding(.trailing, 4)
            } minimal: {
                // Minimal: Displayed when another activity shares the island
                Image(systemName: "car.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.green)
            }
        }
    }
}

// Lock Screen / StandBy Widget View
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<ParkingActivityAttributes>

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "car.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.black)
                        .padding(5)
                        .background(Color.green)
                        .clipShape(Circle())
                    Text("ParkZone")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundColor(.white)
                }

                Spacer()

                HStack(spacing: 4) {
                    Circle()
                        .fill(context.state.isWarning ? Color.orange : Color.green)
                        .frame(width: 6, height: 6)
                    Text("LIVE ACTIVITY")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundColor(context.state.isWarning ? .orange : .green)
                }
            }

            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.green)
                        Text("Spot \(context.attributes.bayNumber)")
                            .font(.system(size: 18, weight: .black))
                            .foregroundColor(.white)
                    }
                    Text(context.attributes.locationName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                        .lineLimit(1)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(context.state.isWarning ? .orange : .green)
                    Text("remaining")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gray)
                }
            }

            ProgressView(value: context.state.progressPercent, total: 100.0)
                .progressViewStyle(LinearProgressViewStyle(tint: context.state.isWarning ? Color.orange : Color.green))
                .background(Color.white.opacity(0.15))
                .clipShape(Capsule())
                .frame(height: 5)
        }
        .padding(14)
        .background(Color(red: 0.08, green: 0.08, blue: 0.10))
    }
}
