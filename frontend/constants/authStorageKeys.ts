/**
 * AsyncStorage keys shared by the auth, entry routing and guest tutorial code.
 * Other modules hardcode these literals, so the values must not change.
 */

/** "true" once any non-guest account has been authenticated on this device. */
export const HAS_EVER_SIGNED_IN_KEY = "hasEverSignedIn";

/** Random per-install id sent with guest session creation. */
export const GUEST_DEVICE_ID_KEY = "guestDeviceId";

/** "true" once the given guest user has finished the tutorial. */
export const guestTutorialDoneKey = (userId: string) => `${userId}-guest-tutorial-done`;

/** "true" once this install has started a guest session, so the guest's own
 * cached state is never mistaken for a pre-existing account. */
export const GUEST_INSTALL_KEY = "guestInstall";

/** "true" once the given guest has been shown the account prompt after their
 * first self-created task. */
export const accountPromptFirstTaskKey = (userId: string) => `${userId}-account-prompt-first-task`;
