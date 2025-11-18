import React, { useState } from "react";
import { StyleSheet, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "../ThemedText";
import PrimaryButton from "../inputs/PrimaryButton";

export type RewardInfo = {
    type: "voice" | "naturalLanguage" | "group" | "integration" | "analytics";
    title: string;
    description: string;
    kudosCost: number;
    creditsAmount?: number;
};

export type KudosType = "encouragements" | "congratulations";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    reward: RewardInfo;
    encouragementsBalance: number;
    congratulationsBalance: number;
    onConfirm: (kudosType: KudosType) => void;
    onCancel: () => void;
    isRedeeming?: boolean;
};

const RewardRedemptionModal = (props: Props) => {
    const { visible, setVisible, reward, encouragementsBalance, congratulationsBalance, onConfirm, onCancel, isRedeeming = false } = props;
    const ThemedColor = useThemeColor();
    const [selectedKudosType, setSelectedKudosType] = useState<KudosType | null>(null);

    const canUseEncouragements = encouragementsBalance >= reward.kudosCost;
    const canUseCongratulations = congratulationsBalance >= reward.kudosCost;
    const canRedeem = canUseEncouragements || canUseCongratulations;

    const handleConfirm = () => {
        if (selectedKudosType && !isRedeeming) {
            onConfirm(selectedKudosType);
        }
    };

    const handleCancel = () => {
        if (!isRedeeming) {
            setSelectedKudosType(null);
            onCancel();
            setVisible(false);
        }
    };

    // Reset selection when modal opens
    React.useEffect(() => {
        if (visible) {
            setSelectedKudosType(null);
        }
    }, [visible]);

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["55%"]}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText type="title" style={{ marginBottom: 16, fontSize: 28 }}>
                        Claim Reward
                    </ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.rewardTitle}>
                        {reward.title}
                    </ThemedText>
                </View>

                <View style={styles.content}>
                    <ThemedText style={styles.description}>
                        {reward.description}
                    </ThemedText>

                    <View style={styles.costContainer}>
                        <ThemedText type="defaultSemiBold" style={styles.costLabel}>
                            Cost:
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={[styles.costValue, { color: ThemedColor.primary }]}>
                            {reward.kudosCost} Kudos
                        </ThemedText>
                    </View>

                    <View style={styles.kudosTypeSection}>
                        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                            Choose Kudos Type:
                        </ThemedText>
                        
                        {/* Encouragements Option */}
                        <TouchableOpacity
                            style={[
                                styles.kudosOption,
                                { backgroundColor: ThemedColor.lightenedCard },
                                selectedKudosType === "encouragements" && styles.selectedOption,
                                selectedKudosType === "encouragements" && { borderColor: ThemedColor.primary, borderWidth: 2 },
                                !canUseEncouragements && styles.disabledOption,
                            ]}
                            onPress={() => canUseEncouragements && !isRedeeming && setSelectedKudosType("encouragements")}
                            disabled={!canUseEncouragements || isRedeeming}
                        >
                            <View style={styles.kudosOptionContent}>
                                <ThemedText type="defaultSemiBold" style={styles.kudosOptionTitle}>
                                    Encouragements
                                </ThemedText>
                                <ThemedText style={[
                                    styles.kudosBalance,
                                    !canUseEncouragements && { color: "#ef4444" }
                                ]}>
                                    Balance: {encouragementsBalance}
                                </ThemedText>
                            </View>
                            {selectedKudosType === "encouragements" && (
                                <View style={[styles.checkmark, { backgroundColor: ThemedColor.primary }]}>
                                    <ThemedText style={styles.checkmarkText}>✓</ThemedText>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Congratulations Option */}
                        <TouchableOpacity
                            style={[
                                styles.kudosOption,
                                { backgroundColor: ThemedColor.lightenedCard },
                                selectedKudosType === "congratulations" && styles.selectedOption,
                                selectedKudosType === "congratulations" && { borderColor: ThemedColor.primary, borderWidth: 2 },
                                !canUseCongratulations && styles.disabledOption,
                            ]}
                            onPress={() => canUseCongratulations && !isRedeeming && setSelectedKudosType("congratulations")}
                            disabled={!canUseCongratulations || isRedeeming}
                        >
                            <View style={styles.kudosOptionContent}>
                                <ThemedText type="defaultSemiBold" style={styles.kudosOptionTitle}>
                                    Congratulations
                                </ThemedText>
                                <ThemedText style={[
                                    styles.kudosBalance,
                                    !canUseCongratulations && { color: "#ef4444" }
                                ]}>
                                    Balance: {congratulationsBalance}
                                </ThemedText>
                            </View>
                            {selectedKudosType === "congratulations" && (
                                <View style={[styles.checkmark, { backgroundColor: ThemedColor.primary }]}>
                                    <ThemedText style={styles.checkmarkText}>✓</ThemedText>
                                </View>
                            )}
                        </TouchableOpacity>

                        {!canRedeem && (
                            <ThemedText style={[styles.insufficientText, { color: "#ef4444" }]}>
                                You need {reward.kudosCost} of either kudos type
                            </ThemedText>
                        )}
                    </View>
                </View>

                <View style={styles.actions}>
                    <PrimaryButton
                        title="Cancel"
                        outline
                        onPress={handleCancel}
                        disabled={isRedeeming}
                    />

                    <PrimaryButton
                        title={isRedeeming ? "Claiming..." : "Claim Reward"}
                        onPress={handleConfirm}
                        disabled={!selectedKudosType || isRedeeming}
                        style={(!selectedKudosType || isRedeeming) ? { ...styles.claimButton, ...styles.disabledButton } : styles.claimButton}
                    >
                        {isRedeeming && (
                            <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                        )}
                    </PrimaryButton>
                </View>
            </View>
        </DefaultModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
    },
    rewardTitle: {
        fontSize: 18,
        textAlign: "center",
    },
    content: {
        marginBottom: 32,
        gap: 16,
    },
    description: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        opacity: 0.8,
    },
    costContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: "rgba(100, 100, 255, 0.1)",
        borderRadius: 12,
    },
    costLabel: {
        fontSize: 16,
    },
    costValue: {
        fontSize: 18,
    },
    balanceContainer: {
        alignItems: "center",
        gap: 4,
    },
    balanceText: {
        fontSize: 14,
        opacity: 0.7,
    },
    insufficientText: {
        fontSize: 13,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 8,
    },
    kudosTypeSection: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 15,
        marginBottom: 4,
    },
    kudosOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "transparent",
    },
    selectedOption: {
        // Border color is set dynamically
    },
    disabledOption: {
        opacity: 0.5,
    },
    kudosOptionContent: {
        flex: 1,
        gap: 4,
    },
    kudosOptionTitle: {
        fontSize: 15,
    },
    kudosBalance: {
        fontSize: 13,
        opacity: 0.7,
    },
    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    checkmarkText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    actions: {
        flexDirection: "column",
        gap: 12,
    },
    claimButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    disabledButton: {
        opacity: 0.5,
    },
});

export default RewardRedemptionModal;

