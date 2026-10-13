import ExpoModulesCore
import ActivityKit

public class ParkingLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ParkingLiveActivityModule")

        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        AsyncFunction("startActivity") { (bayNumber: String, locationName: String, plate: String, totalSeconds: Double, remainingSeconds: Double) -> Bool in
            guard #available(iOS 16.1, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
                return false
            }

            let now = Date()
            let endTime = now.addingTimeInterval(remainingSeconds)
            let attributes = ParkingActivityAttributes(
                bayNumber: bayNumber,
                locationName: locationName,
                plate: plate,
                totalSeconds: totalSeconds,
                startTime: now
            )

            let progress = max(0.0, min(100.0, ((totalSeconds - remainingSeconds) / max(1.0, totalSeconds)) * 100.0))
            let contentState = ParkingActivityAttributes.ContentState(
                remainingSeconds: remainingSeconds,
                progressPercent: progress,
                isWarning: remainingSeconds < 900,
                endTime: endTime
            )

            do {
                // End existing activities to prevent duplicates
                for existing in Activity<ParkingActivityAttributes>.activities {
                    Task {
                        await existing.end(nil, dismissalPolicy: .immediate)
                    }
                }

                _ = try Activity<ParkingActivityAttributes>.request(
                    attributes: attributes,
                    contentState: contentState,
                    pushType: nil
                )
                return true
            } catch {
                print("ParkingLiveActivityModule error: \(error.localizedDescription)")
                return false
            }
        }

        AsyncFunction("updateActivity") { (remainingSeconds: Double, progressPercent: Double) -> Bool in
            guard #available(iOS 16.1, *) else { return false }

            let endTime = Date().addingTimeInterval(remainingSeconds)
            let updatedState = ParkingActivityAttributes.ContentState(
                remainingSeconds: remainingSeconds,
                progressPercent: progressPercent,
                isWarning: remainingSeconds < 900,
                endTime: endTime
            )

            Task {
                for activity in Activity<ParkingActivityAttributes>.activities {
                    await activity.update(using: updatedState)
                }
            }
            return true
        }

        AsyncFunction("endActivity") { () -> Bool in
            guard #available(iOS 16.1, *) else { return false }

            Task {
                for activity in Activity<ParkingActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            return true
        }
    }
}
