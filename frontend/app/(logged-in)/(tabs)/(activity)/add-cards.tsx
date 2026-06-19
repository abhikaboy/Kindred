import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Check } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import {
    DEFAULT_WIDGET_ORDER,
    WIDGET_TITLES,
    WIDGET_META,
    WIDGET_CATEGORIES,
    WidgetId,
} from "@/components/analytics/analyticsLayout";
import { useAnalyticsLayout } from "@/hooks/useAnalyticsLayout";

const TABS = ["All", "Popular", ...WIDGET_CATEGORIES] as const;
type Tab = (typeof TABS)[number];

export default function AddCards() {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { addWidget, toggleHidden, isVisible } = useAnalyticsLayout(user?._id);
    const [tab, setTab] = useState<Tab>("All");

    const widgets = DEFAULT_WIDGET_ORDER.filter((id) => {
        if (tab === "All") return true;
        if (tab === "Popular") return WIDGET_META[id].popular;
        return WIDGET_META[id].category === tab;
    });

    const onToggle = (id: WidgetId) => {
        if (isVisible(id)) {
            toggleHidden(id);
        } else {
            addWidget(id);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title="Add Cards" />
            <View style={styles.tabsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                    {TABS.map((t) => (
                        <TouchableOpacity
                            key={t}
                            activeOpacity={0.7}
                            onPress={() => setTab(t)}
                            style={[
                                styles.tab,
                                {
                                    backgroundColor: tab === t ? ThemedColor.primary : ThemedColor.lightened,
                                    borderColor: tab === t ? ThemedColor.primary : ThemedColor.tertiary,
                                },
                            ]}>
                            <ThemedText
                                type={tab === t ? "defaultSemiBold" : "default"}
                                style={{ color: tab === t ? ThemedColor.buttonText : ThemedColor.text, fontSize: 13 }}>
                                {t}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 110 }}>
                {widgets.map((id) => (
                    <GalleryCard key={id} id={id} added={isVisible(id)} onToggle={() => onToggle(id)} />
                ))}
            </ScrollView>
        </View>
    );
}

function GalleryCard({ id, added, onToggle }: { id: WidgetId; added: boolean; onToggle: () => void }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.card}>
            <View style={styles.cardText}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                    {WIDGET_TITLES[id]}
                </ThemedText>
                <ThemedText type="caption" style={styles.cardDesc}>
                    {WIDGET_META[id].description}
                </ThemedText>
                <View style={styles.categoryChip}>
                    <ThemedText type="caption" style={{ color: ThemedColor.primary, fontSize: 11 }}>
                        {WIDGET_META[id].category}
                    </ThemedText>
                </View>
            </View>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onToggle}
                style={[
                    styles.toggle,
                    added
                        ? { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }
                        : { backgroundColor: ThemedColor.primary, borderColor: ThemedColor.primary },
                ]}>
                {added ? (
                    <Check size={16} color={ThemedColor.text} weight="bold" />
                ) : (
                    <Plus size={16} color={ThemedColor.buttonText} weight="bold" />
                )}
                <ThemedText
                    type="defaultSemiBold"
                    style={{ color: added ? ThemedColor.text : ThemedColor.buttonText, fontSize: 13 }}>
                    {added ? "Added" : "Add"}
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        tabsWrap: {
            paddingLeft: 20,
        },
        tabs: {
            gap: 8,
            paddingRight: 20,
            paddingVertical: 4,
        },
        tab: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
        },
        card: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            padding: 16,
            marginBottom: 12,
            boxShadow: ThemedColor.shadowSmall,
        },
        cardText: {
            flex: 1,
            gap: 4,
        },
        cardTitle: {
            fontSize: 16,
        },
        cardDesc: {
            lineHeight: 18,
        },
        categoryChip: {
            alignSelf: "flex-start",
            backgroundColor: ThemedColor.primary + "1A",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            marginTop: 2,
        },
        toggle: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
        },
    });
