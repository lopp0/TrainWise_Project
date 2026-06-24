using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

namespace TrainWise.BL
{
    // Item 12 — sends a remote push straight to FCM (HTTP v1) via the Firebase
    // Admin SDK, so users are notified even when the app is closed. 100% free
    // (FCM has no cost). Runs anywhere the API is hosted (Azure App Service).
    //
    // Credentials: the Firebase service-account JSON is read from the
    // FIREBASE_CREDENTIALS_JSON environment variable (set it in Azure App Service
    // → Configuration → Application settings, OR locally as an env var). The JSON
    // is NEVER committed to source. If it's absent, every Send is a safe no-op so
    // the app keeps working without push.
    //
    // The device stores its native FCM registration token in Users.PushToken
    // (registered via expo-notifications getDevicePushTokenAsync on the client).
    public static class PushSender
    {
        private static readonly object _lock = new object();
        private static bool _initTried;
        private static FirebaseApp? _app;

        private static FirebaseApp? EnsureApp()
        {
            if (_initTried) return _app;
            lock (_lock)
            {
                if (_initTried) return _app;
                _initTried = true;
                try
                {
                    // Reuse the default app if something already created it.
                    _app = FirebaseApp.DefaultInstance;
                    if (_app != null) return _app;
                }
                catch { /* not created yet — fall through */ }

                try
                {
                    string? json = Environment.GetEnvironmentVariable("FIREBASE_CREDENTIALS_JSON");
                    if (string.IsNullOrWhiteSpace(json))
                    {
                        Console.WriteLine("[PushSender] FIREBASE_CREDENTIALS_JSON not set — push disabled.");
                        return null;
                    }
                    _app = FirebaseApp.Create(new AppOptions
                    {
                        Credential = GoogleCredential.FromJson(json)
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PushSender] init failed: {ex.Message}");
                    _app = null;
                }
                return _app;
            }
        }

        public static void Send(string? fcmToken, string title, string body)
        {
            if (string.IsNullOrWhiteSpace(fcmToken)) return;
            if (EnsureApp() == null) return;

            // Fire-and-forget so the push never blocks the API response.
            _ = Task.Run(async () =>
            {
                try
                {
                    var message = new Message
                    {
                        Token = fcmToken,
                        Notification = new Notification { Title = title, Body = body },
                        Android = new AndroidConfig
                        {
                            Priority = Priority.High,
                            Notification = new AndroidNotification
                            {
                                ChannelId = "trainwise",
                                Sound = "default",
                                Icon = "ic_notification",
                                Color = "#ff2d6f"
                            }
                        }
                    };
                    await FirebaseMessaging.DefaultInstance.SendAsync(message);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PushSender] send failed: {ex.Message}");
                }
            });
        }
    }
}
