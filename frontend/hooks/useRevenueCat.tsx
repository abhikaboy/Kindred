import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { REVENUECAT_API_KEY, ENTITLEMENT_ID } from "@/constants/subscription";
import { useAuth } from "@/hooks/useAuth";
import { createLogger } from "@/utils/logger";

const logger = createLogger("RevenueCat");

interface RevenueCatContextType {
    isReady: boolean;
    customerInfo: CustomerInfo | null;
    currentOffering: PurchasesOffering | null;
    isPro: boolean;
    presentPaywall: () => Promise<boolean>;
    presentPaywallIfNeeded: () => Promise<boolean>;
    presentCustomerCenter: () => Promise<void>;
    restorePurchases: () => Promise<boolean>;
    refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

    const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false;

    useEffect(() => {
        if (Platform.OS === "web") return;
        if (!REVENUECAT_API_KEY) {
            logger.warn("RevenueCat API key not configured");
            return;
        }

        async function init() {
            try {
                if (__DEV__) {
                    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
                }

                Purchases.configure({
                    apiKey: REVENUECAT_API_KEY,
                    appUserID: user?._id ?? undefined,
                });

                const info = await Purchases.getCustomerInfo();
                setCustomerInfo(info);

                const offerings = await Purchases.getOfferings();
                setCurrentOffering(offerings.current);

                setIsReady(true);
                logger.debug("Initialized", {
                    userId: user?._id,
                    isPro: info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false,
                    offeringPackages: offerings.current?.availablePackages.length ?? 0,
                });
            } catch (error) {
                logger.error("Failed to initialize", error);
            }
        }

        init();
    }, [user?._id]);

    useEffect(() => {
        if (!isReady || Platform.OS === "web") return;

        async function syncUserId() {
            if (user?._id) {
                try {
                    const { customerInfo: info } = await Purchases.logIn(user._id);
                    setCustomerInfo(info);
                } catch (error) {
                    logger.error("Failed to sync user ID", error);
                }
            }
        }

        syncUserId();
    }, [user?._id, isReady]);

    useEffect(() => {
        if (!isReady || Platform.OS === "web") return;

        const listener = (info: CustomerInfo) => {
            setCustomerInfo(info);
            logger.debug("Customer info updated", {
                isPro: info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false,
            });
        };

        Purchases.addCustomerInfoUpdateListener(listener);
        return () => {
            Purchases.removeCustomerInfoUpdateListener(listener);
        };
    }, [isReady]);

    const presentPaywall = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") return false;

        try {
            const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

            switch (result) {
                case PAYWALL_RESULT.PURCHASED:
                case PAYWALL_RESULT.RESTORED:
                    logger.debug("Paywall completed with purchase/restore");
                    return true;
                case PAYWALL_RESULT.CANCELLED:
                    logger.debug("Paywall dismissed by user");
                    return false;
                case PAYWALL_RESULT.ERROR:
                    logger.error("Paywall encountered an error");
                    return false;
                default:
                    return false;
            }
        } catch (error: any) {
            // Preview API mode in Expo Go — native paywall not available
            if (error?.message?.includes("document is not available") || error?.message?.includes("Preview API")) {
                logger.warn("Paywall unavailable in Expo Go — requires a development build");
            } else {
                logger.error("Failed to present paywall", error);
            }
            return false;
        }
    }, []);

    const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") return false;

        try {
            const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
                requiredEntitlementIdentifier: ENTITLEMENT_ID,
            });

            switch (result) {
                case PAYWALL_RESULT.PURCHASED:
                case PAYWALL_RESULT.RESTORED:
                    return true;
                case PAYWALL_RESULT.NOT_PRESENTED:
                    logger.debug("Paywall not presented — user already has entitlement");
                    return true;
                default:
                    return false;
            }
        } catch (error: any) {
            if (error?.message?.includes("document is not available") || error?.message?.includes("Preview API")) {
                logger.warn("Paywall unavailable in Expo Go — requires a development build");
            } else {
                logger.error("Failed to present paywall if needed", error);
            }
            return false;
        }
    }, []);

    const presentCustomerCenter = useCallback(async (): Promise<void> => {
        if (Platform.OS === "web") return;

        try {
            await RevenueCatUI.presentCustomerCenter();
        } catch (error: any) {
            if (error?.message?.includes("document is not available") || error?.message?.includes("Preview API")) {
                logger.warn("Customer Center unavailable in Expo Go — requires a development build");
            } else {
                logger.error("Failed to present customer center", error);
            }
        }
    }, []);

    const restorePurchases = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") return false;

        try {
            const info = await Purchases.restorePurchases();
            setCustomerInfo(info);
            const restored = info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false;
            logger.debug("Restore result", { isPro: restored });
            return restored;
        } catch (error) {
            logger.error("Restore failed", error);
            return false;
        }
    }, []);

    const refreshCustomerInfo = useCallback(async () => {
        if (Platform.OS === "web") return;

        try {
            const info = await Purchases.getCustomerInfo();
            setCustomerInfo(info);
        } catch (error) {
            logger.error("Failed to refresh customer info", error);
        }
    }, []);

    return (
        <RevenueCatContext.Provider
            value={{
                isReady,
                customerInfo,
                currentOffering,
                isPro,
                presentPaywall,
                presentPaywallIfNeeded,
                presentCustomerCenter,
                restorePurchases,
                refreshCustomerInfo,
            }}
        >
            {children}
        </RevenueCatContext.Provider>
    );
}

export function useRevenueCat() {
    const context = useContext(RevenueCatContext);
    if (!context) {
        throw new Error("useRevenueCat must be used within a RevenueCatProvider");
    }
    return context;
}
