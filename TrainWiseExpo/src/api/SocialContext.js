import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  getChallengeInvites,
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

// Per-account "seen" ledger for the challenge-invite badge. The badge shows the
// count of invites the user has NOT yet looked at; opening the Challenges screen
// marks the current invites seen so the red bubble clears (it used to stay lit
// until the invite was accepted/declined — the device-test #3 complaint). New
// invites arriving later re-raise the badge because their ids aren't in the set.
const seenChallengeKey = (uid) => `@trainwise_seen_challenge_invites_${uid}`;

const SocialContext = createContext({
  friendRequestCount: 0,
  coachOfferCount: 0,
  challengeInviteCount: 0,
  pendingTotal: 0,
  refresh: () => {},
  markChallengeInvitesSeen: () => {},
});

export const SocialProvider = ({ children }) => {
  const { userId, user } = useAuth();
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [coachOfferCount, setCoachOfferCount] = useState(0);
  const [challengeInviteCount, setChallengeInviteCount] = useState(0); // #142 invites

  // Known sets so we only notify on genuinely NEW items (not every poll).
  const knownFriendIds = useRef(null);     // Set<number> | null (null = not yet primed)
  const knownRequestIds = useRef(null);
  const knownOfferIds = useRef(null);
  const knownChallengeIds = useRef(null);

  // Clear-on-seen ledger for challenge invites (#3): the ids the user has viewed
  // (persisted) + the ids currently pending (so markSeen knows what to record).
  const seenChallengeIds = useRef(new Set());
  const currentChallengeIds = useRef(new Set());

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

    // #142 — pending challenge invitations. Badge = UNSEEN invites only (see
    // seenChallengeIds) so it clears once the user opens the Challenges screen.
    try {
      const res = await getChallengeInvites(userId);
      const rows = Array.isArray(res.data) ? res.data : [];
      const idList = rows.map((r) => r.challengeID ?? r.ChallengeID);
      currentChallengeIds.current = new Set(idList);
      const seen = seenChallengeIds.current || new Set();
      setChallengeInviteCount(idList.filter((id) => !seen.has(id)).length);
      const ids = new Set(idList);
      if (knownChallengeIds.current) {
        const fresh = rows.find((r) => !knownChallengeIds.current.has(r.challengeID ?? r.ChallengeID));
        if (fresh) {
          sendLocalNotification('Challenge invitation 🏆', `${fName({ fullName: fresh.creatorName ?? fresh.CreatorName })} invited you to "${fresh.title ?? fresh.Title}".`, 'social');
        }
      }
      knownChallengeIds.current = ids;
    } catch {
      // endpoint not ready / offline — keep last count
    }
  }, [userId, user?.isTrainee]);

  // Mark challenge invites as seen → clears the badge. Called by the Challenges
  // screen on focus with the ids IT just fetched (so it doesn't depend on the
  // 90s poll having run recently); falls back to the last polled set otherwise.
  // Persists so a restart keeps them cleared; a genuinely new invite (unseen id)
  // re-raises the badge on the next poll.
  const markChallengeInvitesSeen = useCallback(async (ids) => {
    const incoming = Array.isArray(ids) && ids.length ? ids : [...currentChallengeIds.current];
    const merged = new Set([...(seenChallengeIds.current || []), ...incoming]);
    seenChallengeIds.current = merged;
    setChallengeInviteCount(0);
    if (!userId) return;
    try {
      await AsyncStorage.setItem(seenChallengeKey(userId), JSON.stringify([...merged]));
    } catch {
      // best-effort — the in-memory set still clears the badge this session
    }
  }, [userId]);

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

  // Reset known-sets when the account changes (logout/login), then reload this
  // account's persisted "seen challenge invites" ledger so the badge reflects
  // only invites this user hasn't looked at yet.
  useEffect(() => {
    knownFriendIds.current = null;
    knownRequestIds.current = null;
    knownOfferIds.current = null;
    knownChallengeIds.current = null;
    currentChallengeIds.current = new Set();
    seenChallengeIds.current = new Set();
    setFriendRequestCount(0);
    setCoachOfferCount(0);
    setChallengeInviteCount(0);
    if (!userId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(seenChallengeKey(userId));
        seenChallengeIds.current = new Set(raw ? JSON.parse(raw) : []);
      } catch {
        seenChallengeIds.current = new Set();
      }
    })();
  }, [userId]);

  const value = {
    friendRequestCount,
    coachOfferCount,
    challengeInviteCount,
    pendingTotal: friendRequestCount + coachOfferCount + challengeInviteCount,
    refresh: poll,
    markChallengeInvitesSeen,
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
};

export const useSocial = () => useContext(SocialContext);

export default SocialContext;
