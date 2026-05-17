import React, { useEffect } from "react";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";

/**
 * Redirects /friends/:id to /account/:id where the full profile lives.
 */
export default function FriendRedirect() {
    const { id } = useLocalSearchParams();
    return <Redirect href={`/account/${id}`} />;
}
