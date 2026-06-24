-- Item 12 — store each device's Expo push token so the backend can send
-- remote notifications that arrive even when the app is closed.
-- Idempotent: safe to re-run. Run on BOTH local SQL Express and Azure SQL.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'PushToken'
)
BEGIN
    ALTER TABLE dbo.Users ADD PushToken NVARCHAR(255) NULL;
END
GO
