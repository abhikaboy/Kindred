import React from "react";
import { ThemedText } from "../ThemedText";
import UserInfoRowBase from "./UserInfoRowBase";
import FollowButton from "../inputs/FollowButton";

type Props = {
    name: string;
    username: string;
    icon: string;
    id?: string;
    connectionType?: any;
};

const UserInfoRowFollow = ({ name, username, icon, id, connectionType = "none" }: Props) => {
    return (
        <UserInfoRowBase
            name={name}
            username={username}
            right={<FollowButton connectionType={connectionType} />}
            icon={icon}
            id={id}
        />
    );
};

export default UserInfoRowFollow;
