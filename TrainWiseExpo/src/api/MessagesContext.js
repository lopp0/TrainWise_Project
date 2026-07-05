import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { getUnreadMessageCount } from '../services/api';
import { sendLocalNotification, registerForPushToken } from './NotificationService';

/**
 * MessagesContext
 *
 * Lightweight global poller for unread chat messages. While the user is logged
 * in and the app is active, it polls the unread count and:
 *   - exposes `unreadCount` (used for the chat-bubble badge), and
 *   - fires a local notification when the count goes UP (a new message arrived
 *     while the user was elsewhere in the app).
 *
 * It is a foreground/while-open mechanism — true background push would need an
 * Expo push token + a server-side trigger, which the app doesn't have yet.
 */
const MessagesContext = createContext({ unreadCount: 0, refreshUnread: () => {} });

export const useMessages = () => useContext(MessagesContext);

// 60s (was 12s): the unread badge doesn't need second-level freshness, and a
// 12s poll kept Azure SQL constantly awake (it never auto-paused), burning the
// serverless free vCore allowance. Polling also stops while backgrounded (below).
const POLL_MS = 60000;
// Stop polling after this long continuously foregrounded, so a phone left with
// the app open (screen on, untouched) stops hitting Azure SQL and lets the
// serverless DB auto-pause. Polling resumes the next time the app is brought to
// the foreground (background→active). This is the safeguard against the
// "left it running and it drained the vCores" case.
const IDLE_STOP_MS = 15 * 60 * 1000;

export const MessagesProvider = ({ children }) => {
  const { userId, isLoggedIn } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  // null until the first fetch sets the baseline, so we don't fire a
  // notification for messages that were already unread when the app opened.
  const prevRef = useRef(null);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getUnreadMessageCount(userId);
      const count = res.data?.count ?? res.data ?? 0;
      setUnreadCount(count);
      if (prevRef.current != null && count > prevRef.current) {
        sendLocalNotification(
          'New message 💬',
          'You have a new message in TrainWise.',
          'messages'
        );
      }
      prevRef.current = count;
    } catch {
      // Endpoint not ready / offline — try again on the next tick.
    }
  }, [userId]);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      prevRef.current = null;
      setUnreadCount(0);
      return undefined;
    }
    // Register this device for remote push (item 12) once we know who's signed
    // in. Safe no-op on builds without FCM.
    registerForPushToken(userId);

    // Only poll while the app is in the FOREGROUND. When backgrounded we stop
    // the interval entirely so the app isn't hitting Azure SQL from a phone in
    // someone's pocket — that's what kept the serverless DB from auto-pausing.
    let intervalId = null;
    let idleTimer = null;
    const stopPolling = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };
    const startPolling = () => {
      if (intervalId == null) {
        refreshUnread();
        intervalId = setInterval(refreshUnread, POLL_MS);
      }
      // (Re)arm the idle auto-stop each time we (re)start on foreground.
      if (idleTimer != null) clearTimeout(idleTimer);
      idleTimer = setTimeout(stopPolling, IDLE_STOP_MS);
    };

    if (AppState.currentState === 'active') startPolling();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startPolling();
      else stopPolling();
    });
    return () => {
      stopPolling();
      sub.remove();
    };
  }, [isLoggedIn, userId, refreshUnread]);

  return (
    <MessagesContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </MessagesContext.Provider>
  );
};

export default MessagesContext;
