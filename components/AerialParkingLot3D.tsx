import React, { useMemo } from "react";
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ParkingSpace, TopologyType } from "../app/services/parking";

interface Props {
    topology: TopologyType;
    spaces: ParkingSpace[];
    selectedSpaceId: string | null;
    onSelectSpace: (space: ParkingSpace) => void;
    currentZone: string;
}

const { width } = Dimensions.get("window");

/**
 * Procedural 3D Aerial Vehicle Component
 * Renders an orthographic top-down 3D vehicle directly in code
 * with drop shadow, metallic beveled chassis, tinted glass canopy,
 * and illumination headlights/taillights.
 */
const ProceduralAerialCar = ({
    color = "#1F2428",
    isEV = false,
    rotationDeg = 0,
}: {
    color?: string;
    isEV?: boolean;
    rotationDeg?: number;
}) => {
    return (
        <View
            style={[
                styles.carWrapper,
                { transform: [{ rotate: `${rotationDeg}deg` }] },
            ]}
        >
            {/* Soft Radial Base Shadow */}
            <View style={styles.carShadow} />

            {/* Beveled Metallic Chassis */}
            <View style={[styles.carChassis, { backgroundColor: color }]}>
                {/* Hood Lines / Headlights */}
                <View style={styles.headlightsRow}>
                    <View style={styles.headlight} />
                    <View style={styles.headlight} />
                </View>

                {/* Tinted Aerodynamic Glass Canopy */}
                <View style={styles.glassCanopy}>
                    <View style={styles.windshield} />
                    {isEV ? (
                        <View style={styles.evRoofSolarBadge}>
                            <Text style={styles.evBadgeGlyph}>EV</Text>
                        </View>
                    ) : (
                        <View style={styles.sunroof} />
                    )}
                    <View style={styles.rearGlass} />
                </View>

                {/* Taillights */}
                <View style={styles.taillightsRow}>
                    <View style={styles.taillight} />
                    <View style={styles.taillight} />
                </View>
            </View>
        </View>
    );
};

export const AerialParkingLot3D: React.FC<Props> = ({
    topology,
    spaces,
    selectedSpaceId,
    onSelectSpace,
    currentZone,
}) => {
    // Rotation angle based on Kigali topology
    const stallAngle = useMemo(() => {
        switch (topology) {
            case "oblique":
                return -45; // 45° diagonal downtown street
            case "parallel":
                return 90; // 0° / 90° in-line parallel
            case "perpendicular":
            default:
                return 0; // 90° commercial garage
        }
    }, [topology]);

    // Split spaces into two banks / rows for driving aisle
    const leftBank = spaces.filter((_, idx) => idx % 2 === 0);
    const rightBank = spaces.filter((_, idx) => idx % 2 === 1);

    const renderStall = (space: ParkingSpace, isRightBank: boolean) => {
        const isSelected = selectedSpaceId === space.id;
        const isVacant = !space.is_occupied;
        const rotation = topology === "oblique" ? (isRightBank ? 45 : -45) : stallAngle;

        return (
            <TouchableOpacity
                key={space.id}
                activeOpacity={0.75}
                onPress={() => onSelectSpace(space)}
                style={[
                    styles.stallBox,
                    topology === "oblique" && styles.stallOblique,
                    topology === "parallel" && styles.stallParallel,
                    isVacant ? styles.stallVacant : styles.stallOccupied,
                    isSelected && styles.stallSelected,
                ]}
            >
                {/* Stall Header Badge */}
                <View style={styles.stallHeader}>
                    <Text
                        style={[
                            styles.stallNumber,
                            isVacant ? styles.textVacant : styles.textOccupied,
                            isSelected && styles.textSelected,
                        ]}
                    >
                        {space.space_number}
                    </Text>
                    {space.space_type === "ev" && <Text style={styles.evMarker}>EV</Text>}
                    {space.space_type === "handicap" && <Text style={styles.hMarker}>H</Text>}
                </View>

                {/* Procedural 3D Car or Vacant Markings */}
                <View style={styles.stallCenterContent}>
                    {space.is_occupied ? (
                        <ProceduralAerialCar
                            color={isRightBank ? "#1E293B" : "#111827"}
                            isEV={space.space_type === "ev"}
                            rotationDeg={rotation}
                        />
                    ) : (
                        <View style={styles.vacantTarget}>
                            <View
                                style={[
                                    styles.vacantReticle,
                                    isSelected && styles.vacantReticleSelected,
                                ]}
                            />
                            <Text
                                style={[
                                    styles.vacantLabel,
                                    isSelected && styles.vacantLabelSelected,
                                ]}
                            >
                                VACANT
                            </Text>
                        </View>
                    )}
                </View>

                {/* Stall Floor Plate Label */}
                <View style={styles.stallFooter}>
                    {space.is_occupied ? (
                        <Text style={styles.platePlate}>{space.current_vehicle_plate || "PARKED"}</Text>
                    ) : (
                        <Text style={styles.priceTag}>300 RWF/hr</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (spaces.length === 0) {
        return (
            <View style={styles.container}>
                <View style={[styles.asphaltGround, { paddingVertical: 32, alignItems: "center" }]}>
                    <Text style={{ color: "#CCFF00", fontSize: 13, fontWeight: "900", marginBottom: 6 }}>
                        NO BAYS CONFIGURED IN THIS ZONE
                    </Text>
                    <Text style={{ color: "#8B949E", fontSize: 11, textAlign: "center", paddingHorizontal: 20, lineHeight: 16 }}>
                        No parking spaces have been added to {currentZone} yet. Configure spaces and layouts via the Admin Panel.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Aerial Asphalt Ground Plane */}
            <View style={styles.asphaltGround}>
                {/* Topology & Zone Ribbon Indicator */}
                <View style={styles.lotMetaBar}>
                    <View style={styles.topologyBadge}>
                        <Text style={styles.topologyBadgeText}>
                            TOPOLOGY: {topology.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.zoneActiveText}>{currentZone}</Text>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.aisleContainer}>
                        {/* Upper / Left Bank Stalls */}
                        <View style={styles.bankRow}>
                            {leftBank.map((s) => renderStall(s, false))}
                        </View>

                        {/* Central Asphalt Driving Lane / Aisle Marking */}
                        <View style={styles.drivingAisle}>
                            <View style={styles.aisleDashedLine} />
                            <Text style={styles.aisleDirectionIndicator}>ONE WAY {">"}</Text>
                            <View style={styles.aisleDashedLine} />
                        </View>

                        {/* Lower / Right Bank Stalls */}
                        <View style={styles.bankRow}>
                            {rightBank.map((s) => renderStall(s, true))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        backgroundColor: "#000000",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#222222",
        marginVertical: 10,
    },
    asphaltGround: {
        backgroundColor: "#0A0D10",
        padding: 14,
    },
    lotMetaBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    topologyBadge: {
        backgroundColor: "#161B22",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#2D333B",
    },
    topologyBadgeText: {
        color: "#CCFF00",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.5,
    },
    zoneActiveText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "800",
    },
    scrollContent: {
        paddingRight: 30,
    },
    aisleContainer: {
        flexDirection: "column",
        gap: 8,
    },
    bankRow: {
        flexDirection: "row",
        gap: 12,
    },
    drivingAisle: {
        height: 38,
        backgroundColor: "#0D1117",
        borderRadius: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: "#1E2228",
        borderStyle: "dashed",
        marginVertical: 2,
    },
    aisleDashedLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#333D47",
    },
    aisleDirectionIndicator: {
        color: "#4A5568",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.5,
        marginHorizontal: 12,
    },
    stallBox: {
        width: 104,
        height: 142,
        backgroundColor: "#11161D",
        borderRadius: 14,
        padding: 8,
        justifyContent: "space-between",
        borderWidth: 1.5,
        borderColor: "#2D3748",
    },
    stallOblique: {
        transform: [{ skewX: "-10deg" }],
    },
    stallParallel: {
        width: 130,
        height: 96,
    },
    stallVacant: {
        borderColor: "#22C55E",
        backgroundColor: "#071B0F",
    },
    stallOccupied: {
        borderColor: "#7F1D1D",
        backgroundColor: "#1C0D0D",
    },
    stallSelected: {
        borderColor: "#CCFF00",
        borderWidth: 2.5,
        backgroundColor: "transparent",
        shadowColor: "#CCFF00",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 6,
    },
    stallHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    stallNumber: {
        fontSize: 12,
        fontWeight: "900",
    },
    textVacant: {
        color: "#22C55E",
    },
    textOccupied: {
        color: "#EF4444",
    },
    textSelected: {
        color: "#CCFF00",
    },
    evMarker: {
        color: "#22C55E",
        fontSize: 9,
        fontWeight: "800",
    },
    hMarker: {
        color: "#60A5FA",
        fontSize: 11,
    },
    stallCenterContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    vacantTarget: {
        alignItems: "center",
        justifyContent: "center",
    },
    vacantReticle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#22C55E",
        borderStyle: "dashed",
        marginBottom: 4,
    },
    vacantReticleSelected: {
        borderColor: "#CCFF00",
    },
    vacantLabel: {
        color: "#22C55E",
        fontSize: 9,
        fontWeight: "900",
        letterSpacing: 0.5,
    },
    vacantLabelSelected: {
        color: "#CCFF00",
    },
    stallFooter: {
        alignItems: "center",
    },
    platePlate: {
        color: "#94A3B8",
        fontSize: 8,
        fontWeight: "700",
    },
    priceTag: {
        color: "#4ADE80",
        fontSize: 9,
        fontWeight: "700",
    },

    // Procedural Aerial Car Styles
    carWrapper: {
        width: 48,
        height: 82,
        justifyContent: "center",
        alignItems: "center",
    },
    carShadow: {
        position: "absolute",
        width: 52,
        height: 86,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 12,
    },
    carChassis: {
        width: 44,
        height: 78,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#334155",
        justifyContent: "space-between",
        paddingVertical: 4,
        alignItems: "center",
    },
    headlightsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "74%",
    },
    headlight: {
        width: 6,
        height: 3,
        backgroundColor: "#FEF08A",
        borderRadius: 2,
    },
    glassCanopy: {
        width: 32,
        height: 44,
        backgroundColor: "#0B0F14",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#1E293B",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 3,
    },
    windshield: {
        width: 26,
        height: 8,
        backgroundColor: "#1E293B",
        borderRadius: 2,
    },
    sunroof: {
        width: 22,
        height: 12,
        backgroundColor: "#0F172A",
        borderRadius: 2,
    },
    evRoofSolarBadge: {
        backgroundColor: "#064E3B",
        paddingHorizontal: 4,
        borderRadius: 3,
    },
    evBadgeGlyph: {
        color: "#34D399",
        fontSize: 8,
    },
    rearGlass: {
        width: 24,
        height: 7,
        backgroundColor: "#1E293B",
        borderRadius: 2,
    },
    taillightsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "74%",
    },
    taillight: {
        width: 6,
        height: 3,
        backgroundColor: "#EF4444",
        borderRadius: 2,
    },
});
