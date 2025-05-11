// redirect to login if not logged in
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { useEffect } from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        console.log("user from layout", user);
        if (!user) {
            console.log("user is not logged in");
            setTimeout(() => {
                router.navigate("/login");
                console.log("user is not logged in pt 2");
            }, 100);
        }
    }, [user]);

    return <>{children}</>;
};

export default layout;
