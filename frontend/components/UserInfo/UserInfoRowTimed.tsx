import React from "react";
import { ThemedText } from "../ThemedText";
import UserInfoRowBase from "./UserInfoRowBase";

type Props = {
    name: string;
    username: string;
    time: number;
    icon: string;
    id?: string;
};

const UserInfoRowTimed = ({ name, username, time, icon, id }: Props) => {
    return (
        <UserInfoRowBase
            name={name}
            username={username}
            right={<ThemedText type="caption">{time}hr ago</ThemedText>}
            icon={icon}
            id={id}
        />
    );
};

export default UserInfoRowTimed;
