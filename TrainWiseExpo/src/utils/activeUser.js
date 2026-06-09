/**
 * activeUser
 *
 * Holds the currently-logged-in userId so device-local stores (coins, streak,
 * owned/equipped shop items) can be namespaced PER ACCOUNT. Without this, every
 * account on the same phone shared one global `@trainwise_coins` /
 * `@trainwise_owned_items` key — buying a badge on one account spent coins and
 * unlocked items on all of them.
 *
 * Set imperatively (synchronously) from AuthContext the moment the user becomes
 * known (bootstrap restore + login) and cleared on logout, so it's populated
 * before any screen's focus effect runs a check-in or shop read.
 */
let _activeUserId = null;

export const setActiveUserId = (id) => {
  _activeUserId = id !== null && id !== undefined ? String(id) : null;
};

export const getActiveUserId = () => _activeUserId;

/**
 * Namespace a base AsyncStorage key by the active user. Falls back to the bare
 * key only when no user is active (shouldn't happen during normal app use).
 */
export const scopedKey = (base) => (_activeUserId ? `${base}__u${_activeUserId}` : base);
