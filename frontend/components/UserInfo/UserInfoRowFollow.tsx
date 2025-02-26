import React from "react";
import { ThemedText } from "../ThemedText";
import UserInfoRowBase from "./UserInfoRowBase";
import FollowButton from "../inputs/FollowButton";

type Props = {
    name: string;
    username: string;
    icon: string;
    id?: string;
};

const UserInfoRowFollow = ({ name, username, icon}: Props) => {
    return (
        <UserInfoRowBase name={name} username={username} right={<FollowButton following={false} />} icon={icon} large
/>
    );
};

export default UserInfoRowFollow;
