export const REVENUECAT_API_KEY =
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

export const ENTITLEMENT_ID = "Kindred Pro";

// Feature flag to hide all subscription UI until App Store products are approved
export const SUBSCRIPTIONS_ENABLED = false;

export const PRODUCT_IDS = {
    MONTHLY: "monthly",
    YEARLY: "yearly",
    LIFETIME: "lifetime",
} as const;
