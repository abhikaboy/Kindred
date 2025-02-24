import { Dimensions, StyleSheet, ScrollView, View, Text } from "react-native";
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";
import { SearchBox } from "@/components/SearchBox";
import ContactCard from "@/components/cards/ContactCard";
import { Icons } from "@/constants/Icons";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import * as SMS from "expo-sms";
import Animated, {
    FadeIn,
    FadeOut,
    FadeOutDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import UserInfoRowFollow from "@/components/UserInfo/UserInfoRowFollow";

type Props = {};

const Search = (props: Props) => {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [searched, setSearched] = React.useState(false);
    const [focused, setFocused] = React.useState(false);

    const opacity = useSharedValue(1);
    const focusStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    const onPress = async () => {
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
            alert("SMS is not available on this device");
        } else {
            await SMS.sendSMSAsync(" ", "Join me on Social Todo!");
        }
    };

    const onSubmit = () => {
        setSearched(searchTerm.trim() === "");
    };

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.05 : 1);
    }, [focused]);

    return (
        <ThemedView
            style={{
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: 24,
            }}>
            <View style={{ gap: 16 }}>
                <SearchBox
                    value={searchTerm}
                    placeholder={"Search for your friends!"}
                    onChangeText={setSearchTerm}
                    onSubmit={onSubmit}
                    recent={true}
                    name={"search-page"}
                    setFocused={setFocused}
                />
                {!searched && (
                    <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
                        <ThemedText type="subtitle">Contacts</ThemedText>
                        <ScrollView horizontal={true} style={{ gap: 16 }}>
                            <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={true} />
                            <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={false} />
                            <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={true} />
                            <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={false} />
                        </ScrollView>
                        <ThemedText type="subtitle">Invite</ThemedText>
                        <View style={{ gap: 0, flexDirection: "column", alignItems: "center" }}>
                            <Text style={{ fontSize: 128, lineHeight: 128 }}>✉️</Text>
                            <ThemedText type="lightBody">Invite your friends to unlock rewards!</ThemedText>
                            <PrimaryButton
                                style={{ width: "35%", paddingVertical: 12, marginTop: 12 }}
                                title={"Add"}
                                onPress={onPress}
                            />
                        </View>
                    </Animated.View>
                )}
                {searched && (
                    <Animated.View style={[focusStyle]} exiting={FadeOut}>
                        <ThemedText type="subtitle">Results</ThemedText>
                        <ScrollView style={{ marginTop: 20, minHeight: "100%" }} contentContainerStyle={{ gap: 20 }}>
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                        </ScrollView>
                    </Animated.View>
                )}
            </View>
        </ThemedView>
    );
};

export default Search;

const styles = StyleSheet.create({});
