import React, { memo, useRef, useEffect, useState, useCallback } from "react";
import {
    Animated,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as PhosphorIcons from "phosphor-react-native";
import Popover, { Rect } from "react-native-popover-view";

const { width: SCREEN_WIDTH } = Dimensions.get("screen");

const NUM_COLUMNS = 5;
const ICON_CELL_SIZE = Math.floor(SCREEN_WIDTH / NUM_COLUMNS);
const ICON_SIZE = 26;

export const ICON_PRESET_COLORS = [
    "#FF3B3B",
    "#FF6E2C",
    "#3CCF6E",
    "#56BFEE",
    "#A259FF",
    "#2962FF",
];

type PhosphorComponent = React.ComponentType<{
    size?: number;
    weight?: string;
    color?: string;
}>;

const iconCellStyle = {
    width: ICON_CELL_SIZE,
    height: ICON_CELL_SIZE,
    alignItems: "center" as const,
    justifyContent: "center" as const,
};

interface IconCellProps {
    name: string;
    Component: PhosphorComponent;
    onPress: (name: string, pageX: number, pageY: number) => void;
}

const IconCell = memo(({ name, Component, onPress }: IconCellProps) => (
    <TouchableOpacity
        style={iconCellStyle}
        onPress={(e) => onPress(name, e.nativeEvent.pageX, e.nativeEvent.pageY)}
        activeOpacity={0.6}>
        <Component size={ICON_SIZE} color="rgba(255,255,255,0.82)" weight="regular" />
    </TouchableOpacity>
));

// Prefixes that produce navigation/directional icons not useful for workspace labelling
const EXCLUDED_PREFIXES = [
    "Arrow",
    "Caret",
    "Cursor",
    "HandPointing",
    "NavigationArrow",
];

const isExcluded = (name: string) =>
    EXCLUDED_PREFIXES.some((prefix) => name.startsWith(prefix));

// Built once at module level — 1500+ icons, name → component
// Only keep plain names (not the Icon-suffixed duplicates) to avoid showing each icon twice
const ALL_ICONS: { name: string; Component: PhosphorComponent }[] = Object.entries(PhosphorIcons)
    .filter(
        ([key, val]) =>
            typeof val === "function" &&
            key !== "IconContext" &&
            !key.endsWith("Icon") &&
            !isExcluded(key)
    )
    .map(([name, Component]) => ({
        name,
        Component: Component as PhosphorComponent,
    }));

interface IconPickerOverlayProps {
    visible: boolean;
    onClose: () => void;
    /** Called with the chosen icon name and hex color */
    onSelect: (iconName: string, color: string) => void;
}

export const IconPickerOverlay: React.FC<IconPickerOverlayProps> = ({
    visible,
    onClose,
    onSelect,
}) => {
    const insets = useSafeAreaInsets();
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerAnchor, setColorPickerAnchor] = useState<Rect | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const isClosingRef = useRef(false);
    const flatListRef = useRef<FlatList>(null);

    // ── Animated values ────────────────────────────────────────────────────────
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const gridTranslateY = useRef(new Animated.Value(50)).current;
    const gridOpacity = useRef(new Animated.Value(0)).current;

    const filteredIcons = searchQuery
        ? ALL_ICONS.filter((icon) =>
              icon.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : ALL_ICONS;

    useEffect(() => {
        if (visible) {
            isClosingRef.current = false;
            setSelectedIcon(null);
            setShowColorPicker(false);
            setColorPickerAnchor(null);
            setSearchQuery("");
            // Reset values before animating in
            backdropOpacity.setValue(0);
            gridTranslateY.setValue(50);
            gridOpacity.setValue(0);
            animateIn();
        }
    }, [visible]);

    const animateIn = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 280,
                useNativeDriver: true,
            }),
            Animated.spring(gridTranslateY, {
                toValue: 0,
                tension: 85,
                friction: 14,
                useNativeDriver: true,
            }),
            Animated.timing(gridOpacity, {
                toValue: 1,
                duration: 280,
                delay: 60,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const animateOut = useCallback(
        (callback: () => void) => {
            if (isClosingRef.current) return;
            isClosingRef.current = true;
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(gridOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(gridTranslateY, {
                    toValue: 30,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => callback());
        },
        []
    );

    const handleClose = useCallback(() => {
        setShowColorPicker(false);
        animateOut(() => {
            setSelectedIcon(null);
            setColorPickerAnchor(null);
            onClose();
        });
    }, [animateOut, onClose]);

    const handleIconPress = useCallback((iconName: string, pageX: number, pageY: number) => {
        setSelectedIcon(iconName);
        setColorPickerAnchor(
            new Rect(
                pageX - ICON_CELL_SIZE / 2,
                pageY - ICON_CELL_SIZE / 2,
                ICON_CELL_SIZE,
                ICON_CELL_SIZE
            )
        );
        setShowColorPicker(true);
    }, []);

    const handleColorPickerClose = useCallback(() => {
        setShowColorPicker(false);
        setSelectedIcon(null);
        setColorPickerAnchor(null);
    }, []);

    const handleColorSelect = useCallback(
        (iconName: string, color: string) => {
            setShowColorPicker(false);
            animateOut(() => {
                setSelectedIcon(null);
                setColorPickerAnchor(null);
                onSelect(iconName, color);
                onClose();
            });
        },
        [animateOut, onSelect, onClose]
    );

    // ── FlatList helpers ────────────────────────────────────────────────────────

    const renderIcon = useCallback(
        ({ item }: { item: { name: string; Component: PhosphorComponent } }) => (
            <IconCell name={item.name} Component={item.Component} onPress={handleIconPress} />
        ),
        [handleIconPress]
    );

    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: ICON_CELL_SIZE,
            offset: ICON_CELL_SIZE * Math.floor(index / NUM_COLUMNS),
            index,
        }),
        []
    );

    // ── Selected icon component ─────────────────────────────────────────────────

    const SelectedIconComponent: PhosphorComponent | null = selectedIcon
        ? ((PhosphorIcons as any)[selectedIcon] as PhosphorComponent) ?? null
        : null;

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
            {visible && (
                <>
                    {/* Blurred backdrop */}
                    <Animated.View
                        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
                        pointerEvents="none">
                        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />
                    </Animated.View>

                    {/* Background tap → close */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

                    {/* Close button */}
                    <Animated.View
                        style={[styles.closeButton, { top: insets.top + 12, opacity: backdropOpacity }]}
                        pointerEvents="auto">
                        <TouchableOpacity
                            onPress={handleClose}
                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                            <View style={styles.closeButtonInner}>
                                <Ionicons name="close" size={20} color="#ffffff" />
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Icon grid */}
                    <Animated.View
                        style={[
                            styles.gridContainer,
                            {
                                top: insets.top + 56,
                                bottom: insets.bottom,
                                opacity: gridOpacity,
                                transform: [{ translateY: gridTranslateY }],
                            },
                        ]}
                        pointerEvents="auto">
                        {/* Search bar */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search icons..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                            />
                        </View>

                        <FlatList
                            ref={flatListRef}
                            data={filteredIcons}
                            numColumns={NUM_COLUMNS}
                            renderItem={renderIcon}
                            keyExtractor={(item) => item.name}
                            getItemLayout={searchQuery ? undefined : getItemLayout}
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={60}
                            maxToRenderPerBatch={30}
                            windowSize={8}
                            removeClippedSubviews={true}
                            contentContainerStyle={styles.gridContent}
                            keyboardShouldPersistTaps="handled"
                        />
                    </Animated.View>

                    {/* Color picker popover — always mounted so it shows instantly */}
                    <Popover
                        from={colorPickerAnchor ?? new Rect(0, 0, 0, 0)}
                        isVisible={showColorPicker && !!colorPickerAnchor}
                        onRequestClose={handleColorPickerClose}
                        backgroundStyle={styles.popoverBackground}
                        popoverStyle={styles.colorPopover}
                        animationConfig={{ duration: 80 }}>
                        <View style={styles.colorRow}>
                            {ICON_PRESET_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    onPress={() => selectedIcon && handleColorSelect(selectedIcon, color)}
                                    style={styles.colorIconBtn}
                                    activeOpacity={0.7}>
                                    {SelectedIconComponent && (
                                        <SelectedIconComponent size={28} color={color} weight="regular" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Popover>
                </>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        zIndex: 0,
    },
    dimOverlay: {
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    closeButton: {
        position: "absolute",
        right: 20,
        zIndex: 100,
    },
    closeButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    gridContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: "rgba(255,255,255,0.9)",
        fontSize: 16,
        fontFamily: "OutfitLight",
    },
    gridContent: {
        paddingBottom: 20,
    },
    iconCell: {
        width: ICON_CELL_SIZE,
        height: ICON_CELL_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    popoverBackground: {
        backgroundColor: "transparent",
    },
    colorPopover: {
        backgroundColor: "rgba(28,28,35,0.97)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    colorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    colorIconBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.06)",
    },
});

export default IconPickerOverlay;
