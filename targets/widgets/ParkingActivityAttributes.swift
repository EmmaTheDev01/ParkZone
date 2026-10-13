import Foundation
import ActivityKit

public struct ParkingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var remainingSeconds: Double
        public var progressPercent: Double
        public var isWarning: Bool
        public var endTime: Date

        public init(remainingSeconds: Double, progressPercent: Double, isWarning: Bool, endTime: Date) {
            self.remainingSeconds = remainingSeconds
            self.progressPercent = progressPercent
            self.isWarning = isWarning
            self.endTime = endTime
        }
    }

    public var bayNumber: String
    public var locationName: String
    public var plate: String
    public var totalSeconds: Double
    public var startTime: Date

    public init(bayNumber: String, locationName: String, plate: String, totalSeconds: Double, startTime: Date) {
        self.bayNumber = bayNumber
        self.locationName = locationName
        self.plate = plate
        self.totalSeconds = totalSeconds
        self.startTime = startTime
    }
}
