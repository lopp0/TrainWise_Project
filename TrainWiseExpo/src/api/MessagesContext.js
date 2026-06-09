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
import { sendLocalNotification } from './NotificationService';

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

const POLL_MS = 12000;

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
          'You have a new message in TrainWise.'
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
    refreshUnread();
    const id = setInterval(refreshUnread, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshUnread();
    });
    return () => {
      clearInterval(id);
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
