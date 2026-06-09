/**
 * Shared Health Connect storage keys.
 *
 * HC_CONNECTED_BASE stores, per account (via scopedKey), the ISO timestamp at
 * which that account opted into Health Connect. It serves two purposes:
 *   1. Presence = this account is "connected" (drives the Connect button).
 *   2. The timestamp is the sync FLOOR — only workouts started after it are
 *      imported, so multiple accounts on one device don't each inherit the
 *      same historical device workouts.
 */
export const HC_CONNECTED_BASE = '@trainwise_hc_connected';
