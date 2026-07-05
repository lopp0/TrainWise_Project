import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from './AuthContext';
import { sendLocalNotification } from './NotificationService';
import { getShareLocation } from '../utils/locationSharing';
import {
  heartbeat,
  updateMyLocation,
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

// Slowed (heartbeat 60s→3min, inbox 25s→90s) and paused while backgrounded
// (below) so the app stops keeping Azure SQL awake — the 25/60s polls never let
// the serverless DB auto-pause, which burned the free vCore allowance.
const HEARTBEAT_MS = 180000;
const POLL_MS = 90000;
// Stop the heartbeat + inbox poll after this long continuously foregrounded, so
// a phone left with the app open lets the serverless Azure DB auto-pause instead
// of being kept awake indefinitely. Resumes on the next background→foreground.
const IDLE_STOP_MS = 15 * 60 * 1000;

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
          sendLocalNotification('New friend request 👋', `${fName(fresh)} wants to connect on TrainWise.`, 'social');
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
          sendLocalNotification('New friend 🎉', `You and ${fName(fresh)} are now connected. Say hi!`, 'social');
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
            sendLocalNotification('A coach wants to train you 🏋️', `${fName(fresh)} offered to be your coach. Tap Connect to respond.`, 'social');
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

    const ping = async () => {
      if (AppState.currentState !== 'active') return;
      heartbeat(userId).catch(() => {});
      // A-2: when the user opted in, push live GPS so they appear on the map.
      try {
        if (await getShareLocation()) {
          let pos = await Location.getLastKnownPositionAsync();
          if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (pos?.coords) {
            updateMyLocation(userId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
          }
        }
      } catch {}
    };

    // Only run the heartbeat + inbox poll while FOREGROUNDED; stop both when the
    // app is backgrounded so an idle phone stops hitting Azure SQL (lets the
    // serverless DB auto-pause). Returning to the foreground re-pings immediately.
    let hb = null;
    let pl = null;
    let idle = null;
    const stopTimers = () => {
      if (hb != null) { clearInterval(hb); hb = null; }
      if (pl != null) { clearInterval(pl); pl = null; }
      if (idle != null) { clearTimeout(idle); idle = null; }
    };
    const startTimers = () => {
      ping();
      poll();
      if (hb == null) hb = setInterval(ping, HEARTBEAT_MS);
      if (pl == null) pl = setInterval(() => { if (alive) poll(); }, POLL_MS);
      // Auto-stop after IDLE_STOP_MS continuously foregrounded so a phone left
      // with the app open lets Azure SQL auto-pause; resumes on next foreground.
      if (idle != null) clearTimeout(idle);
      idle = setTimeout(stopTimers, IDLE_STOP_MS);
    };

    if (AppState.currentState === 'active') startTimers();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startTimers();
      else stopTimers();
    });

    return () => {
      alive = false;
      stopTimers();
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
