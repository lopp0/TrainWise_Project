import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { scopedKey } from '../utils/activeUser';
import { sendLocalNotification } from './NotificationService';
import { showInAppBanner } from '../components/InAppBanner';
import { navigate } from '../navigation/navigationRef';
import {
  getCoachRecommendationsByUser,
  getCoachesForTrainee,
  getCoachByUserId,
  getTraineesByCoach,
  getActiveInjuriesByUser,
} from '../services/api';

/**
 * EventNotifications
 *
 * Renders nothing. While logged in and the app is active, polls the backend
 * for state changes that warrant a notification and fires a LOCAL notification
 * when something new appears. Together with the new-message poller
 * (MessagesContext), the daily reminder + workout load-warning
 * (NotificationService), this covers the app's 7 notification events:
 *
 *   1. New chat message              (MessagesContext)
 *   2. New coach recommendation      (here, trainee)
 *   3. Trainee reported an injury    (here, coach)  ← #5b
 *   4. New coach <-> trainee link    (here, both sides)
 *   5. Trainee entered overload      (here, coach)
 *   6. Daily training reminder       (NotificationService)
 *   7. Load warning on workout save  (NotificationService)
 *
 * Limitation: local notifications only fire while the app is running
 * (foreground or recently backgrounded). Baselines are persisted per-account,
 * so events that happened while the app was closed are detected on next open.
 * True "app fully closed" delivery would need an Expo push token + a server
 * trigger (documented as the next step).
 */

const POLL_MS = 30000;
const STORE_KEY = '@trainwise_event_baselines';

const EventNotifications = () => {
  const { user, userId, isLoggedIn } = useAuth();
  const isCoach = !!user?.isCoach;
  const isTrainee = !!user?.isTrainee;
  const baselines = useRef(null); // loaded from storage; null until hydrated

  const persist = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        scopedKey(STORE_KEY),
        JSON.stringify(baselines.current || {})
      );
    } catch {
      // non-fatal
    }
  }, []);

  const poll = useCallback(async () => {
    if (!userId || baselines.current == null) return;
    const b = baselines.current;
    const firstRun = b.__init !== true;

    // Compare a numeric counter against its stored baseline; notify on increase.
    const bump = (key, current, makeMsg) => {
      const prev = b[key];
      if (!firstRun && typeof prev === 'number' && current > prev) {
        const m = makeMsg(current - prev);
        if (m) sendLocalNotification(m.title, m.body);
      }
      b[key] = current;
    };

    try {
      // ───── Trainee-side events ─────
      if (isTrainee) {
        try {
          const res = await getCoachRecommendationsByUser(userId);
          const arr = Array.isArray(res.data) ? res.data : [];
          const prevRec = b.recCount;
          if (!firstRun && typeof prevRec === 'number' && arr.length > prevRec) {
            // While the app is open, show the branded in-app top banner;
            // otherwise fall back to an OS notification.
            if (AppState.currentState === 'active') {
              showInAppBanner({
                title: 'New recommendation 📋',
                message: 'Tap to read your coach\'s new recommendation.',
                icon: 'bulb',
                onPress: () => navigate('HomeTab', { screen: 'Warnings' }),
              });
            } else {
              sendLocalNotification(
                'New recommendation 📋',
                'Your coach sent you a new training recommendation.'
              );
            }
          }
          b.recCount = arr.length;
        } catch {
          // endpoint may be unavailable; skip
        }

        try {
          const res = await getCoachesForTrainee(userId);
          const arr = Array.isArray(res.data) ? res.data : [];
          const last = arr.length ? arr[arr.length - 1] : null;
          const name = last ? last.fullName ?? last.FullName : null;
          bump('coachCount', arr.length, () => ({
            title: 'Coach connected 🤝',
            body: name
              ? `You're now connected with coach ${name}.`
              : "You're now connected with a coach.",
          }));
        } catch {
          // skip
        }
      }

      // ───── Coach-side events ─────
      if (isCoach) {
        try {
          const cres = await getCoachByUserId(userId);
          const coachId = cres.data?.coachID ?? cres.data?.CoachID;
          if (coachId) {
            const tres = await getTraineesByCoach(coachId);
            const trainees = Array.isArray(tres.data) ? tres.data : [];
            const last = trainees.length ? trainees[trainees.length - 1] : null;
            const lastName = last ? last.fullName ?? last.FullName : null;
            bump('traineeCount', trainees.length, () => ({
              title: 'New trainee 🎉',
              body: lastName
                ? `${lastName} connected with you.`
                : 'A new trainee connected with you.',
            }));

            const redMap = b.redByTrainee || {};
            const injMap = b.injByTrainee || {};
            for (const t of trainees) {
              const tid = t.userID ?? t.UserID;
              if (tid == null) continue;
              const tname = t.fullName ?? t.FullName ?? `Trainee #${tid}`;

              // Overload transition (green/yellow -> red)
              const level = String(t.loadLevel ?? t.LoadLevel ?? '').toLowerCase();
              const ratio = t.aC_Ratio ?? t.AC_Ratio;
              const isRed = level === 'red' || (ratio != null && Number(ratio) > 1.3);
              if (!firstRun && isRed && !redMap[tid]) {
                sendLocalNotification(
                  'Trainee overload ⚠️',
                  `${tname} is in the overload zone. Consider checking in.`
                );
              }
              redMap[tid] = isRed;

              // New injury reported (#5b)
              try {
                const ires = await getActiveInjuriesByUser(tid);
                const icount = Array.isArray(ires.data) ? ires.data.length : 0;
                const prevI = injMap[tid];
                if (!firstRun && typeof prevI === 'number' && icount > prevI) {
                  sendLocalNotification(
                    'Injury reported 🩹',
                    `${tname} reported a new injury.`
                  );
                }
                injMap[tid] = icount;
              } catch {
                // skip this trainee's injuries
              }
            }
            b.redByTrainee = redMap;
            b.injByTrainee = injMap;
          }
        } catch {
          // no coach profile / endpoint down; skip
        }
      }

      b.__init = true;
      baselines.current = b;
      await persist();
    } catch {
      // never let the poller throw
    }
  }, [userId, isCoach, isTrainee, persist]);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      baselines.current = null;
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(scopedKey(STORE_KEY));
        baselines.current = raw ? JSON.parse(raw) : {};
      } catch {
        baselines.current = {};
      }
      if (alive) poll();
    })();

    const id = setInterval(poll, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') poll();
    });
    return () => {
      alive = false;
      clearInterval(id);
      sub.remove();
    };
  }, [isLoggedIn, userId, poll]);

  return null;
};

export default EventNotifications;
