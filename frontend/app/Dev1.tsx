import { View, Dimensions, ScrollView } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import ThemedColor from "@/constants/Colors";

import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SearchBox } from "@/components/SearchBox";
import FollowButton from "@/components/inputs/FollowButton";
import SendButton from "@/components/inputs/SendButton";
import NextButton from "@/components/inputs/NextButton";
import ThemedSwitch from "@/components/inputs/ThemedSwitch";
import TrafficLight from "@/components/inputs/TrafficLight";
import ThemedSlider from "@/components/inputs/ThemedSlider";
import ThemedInput from "@/components/inputs/ThemedInput";
import Dropdown from "@/components/inputs/Dropdown";
import UserInfoRow from "@/components/UserInfo/UserInfoRowBase";
import { Icons } from "@/constants/Icons";
import ReactPills from "@/components/inputs/ReactPills";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function Dev1() {
    const [searchTerm, setSearchTerm] = React.useState("");
    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: 24,
                gap: 16,
            }}>
            <ThemedText type="title" style={{ fontWeight: "700" }}>
                Development Components 1 - Inputs
            </ThemedText>
            <ScrollView
                contentContainerStyle={{
                    gap: 16,
                    paddingBottom: Dimensions.get("screen").height * 0.12,
                }}>
                <PrimaryButton title="Button" onPress={() => {}} />
                <Dropdown options={[]} selected={{ label: "", id: "" }} setSelected={() => {}} onSpecial={() => {}} />
                <ThemedInput
                    value={""}
                    setValue={() => {}}
                    placeHolder={""}
                    onSubmit={() => {}}
                    onChangeText={() => {}}
                />
                <SearchBox
                    value={searchTerm}
                    placeholder="Search"
                    onChangeText={(text) => {
                        setSearchTerm(text);
                    }}
                    onSubmit={() => {}}
                    recent={true}
                    name="test"
                />
                <SearchBox
                    value={searchTerm}
                    placeholder="Search"
                    onChangeText={(text) => {
                        setSearchTerm(text);
                    }}
                    onSubmit={() => {}}
                />
                <FollowButton following />
                <FollowButton following={false} />
                <View style={{ display: "flex", flexDirection: "row", gap: 16, margin: "auto" }}>
                    <View style={{ width: "80%" }}>
                        <SearchBox
                            value={searchTerm}
                            placeholder="Search"
                            onChangeText={(text) => {
                                setSearchTerm(text);
                            }}
                            onSubmit={() => {}}
                        />
                    </View>
                    <SendButton onSend={() => {}} />
                </View>
                <NextButton onPress={() => {}} />
                <ThemedSwitch />
                <TrafficLight />
                <ThemedSlider />
                <ReactPills reacted={false} emoji={"🔥"} count={4} postId={0}></ReactPills>
                <UserInfoRow name={"Abhik Ray"} username={"beak"} time={2} icon={Icons.luffy}></UserInfoRow>
                <DateTimePicker
                    style={{ width: "100%", height: 100 }}
                    value={new Date()}
                    testID="bruh"
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={(date) => {
                        console.log(date);
                    }}
                />
                <DateTimePicker
                    style={{ width: "100%", height: Dimensions.get("screen").height * 0.4 }}
                    value={new Date()}
                    testID="bruh2"
                    mode="time"
                    display="spinner"
                    onChange={(date) => {
                        console.log(date);
                    }}
                />
            </ScrollView>
        </View>
    );
}
