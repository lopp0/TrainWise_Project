import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { sendLocalNotification } from './NotificationService';
import {
  heartbeat,
  getFriends,
  getFriendRequests,
  getCoachOffersForTrainee,
} from '../services/api';

/**
 * SocialContext (#3)
 *
 * Two jobs, both global so they work no matter which tab is open:
 *   1. PRESENCE — pings /social/presence every 60s while the app is
 *      foregrounded, keeping the user's green "online" dot lit for friends.
 *   2. INBOX POLLING — every 25s checks incoming friend requests, accepted
 *      friendships, and (for trainees) coach offers. When any of those grow,
 *      it fires a local push so BOTH sides of a connection get notified:
 *      the receiver sees the request; the sender sees it was accepted.
 *
 * Exposes badge counts (friendRequestCount + coachOfferCount) + refresh().
 */

const HEARTBEAT_MS = 60000;
const POLL_MS = 25000;

// Backend serializes C# PascalCase as camelCase, but stay tolerant of both.
const fName = (x) => x?.fullName ?? x?.FullName ?? 'Someone';
const fFriendId = (x) => x?.friendUserID ?? x?.FriendUserID;

const SocialContext = createContext({
  friendRequestCount: 0,
  coachOfferCount: 0,
  pendingTotal: 0,
  refresh: () => {},
});

export const SocialProvider = ({ children }) => {
  const { userId, user } = useAuth();
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [coachOfferCount, setCoachOfferCount] = useState(0);

  // Known sets so we only notify on genuinely NEW items (not every poll).
  const knownFriendIds = useRef(null);     // Set<number> | null (null = not yet primed)
  const knownRequestIds = useRef(null);
  const knownOfferIds = useRef(null);

  const poll = useCallback(async () => {
    if (!userId) return;
    // Friend requests addressed to me
    try {
      const res = await getFriendRequests(userId);
      const rows = Array.isArray(res.data) ? res.data : [];
      setFriendRequestCount(rows.length);
      const ids = new Set(rows.map((r) => r.friendshipID ?? r.FriendshipID));
      if (knownRequestIds.current) {
        const fresh = rows.find((r) => !knownRequestIds.current.has(r.friendshipID ?? r.FriendshipID));
        if (fresh) {
          sendLocalNotification('New friend request 👋', `${fName(fresh)} wants to connect on TrainWise.`);
        }
      }
      knownRequestIds.current = ids;
    } catch {
      // offline / endpoint not ready — keep last counts
    }

    // Accepted friends (detects a request I SENT being accepted)
    try {
      const res = await getFriends(userId);
      const rows = Array.isArray(res.data) ? res.data : [];
      const ids = new Set(rows.map(fFriendId));
      if (knownFriendIds.current) {
        const fresh = rows.find((r) => !knownFriendIds.current.has(fFriendId(r)));
        if (fresh) {
          sendLocalNotification('New friend 🎉', `You and ${fName(fresh)} are now connected. Say hi!`);
        }
      }
      knownFriendIds.current = ids;
    } catch {
      // ignore
    }

    // Coach offers (trainee side)
    if (user?.isTrainee !== false) {
      try {
        const res = await getCoachOffersForTrainee(userId);
        const rows = Array.isArray(res.data) ? res.data : [];
        setCoachOfferCount(rows.length);
        const ids = new Set(rows.map((r) => r.offerID ?? r.OfferID));
        if (knownOfferIds.current) {
          const fresh = rows.find((r) => !knownOfferIds.current.has(r.offerID ?? r.OfferID));
          if (fresh) {
            sendLocalNotification('A coach wants to train you 🏋️', `${fName(fresh)} offered to be your coach. Tap Connect to respond.`);
          }
        }
        knownOfferIds.current = ids;
      } catch {
        // ignore
      }
    }
  }, [userId, user?.isTrainee]);

  // Presence heartbeat + inbox polling while logged in & foregrounded.
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    const ping = () => {
      if (AppState.currentState === 'active') heartbeat(userId).catch(() => {});
    };

    ping();
    poll();
    const hb = setInterval(ping, HEARTBEAT_MS);
    const pl = setInterval(() => {
      if (alive) poll();
    }, POLL_MS);

    // Re-ping + re-poll immediately when the app returns to the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        ping();
        poll();
      }
    });

    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(pl);
      sub.remove();
    };
  }, [userId, poll]);

  // Reset known-sets when the account changes (logout/login).
  useEffect(() => {
    knownFriendIds.current = null;
    knownRequestIds.current = null;
    knownOfferIds.current = null;
    setFriendRequestCount(0);
    setCoachOfferCount(0);
  }, [userId]);

  const value = {
    friendRequestCount,
    coachOfferCount,
    pendingTotal: friendRequestCount + coachOfferCount,
    refresh: poll,
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
};

export const useSocial = () => useContext(SocialContext);

export default SocialContext;
