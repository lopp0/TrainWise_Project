/* ============================================================================
   2026-07-19 — REAL "Devices & sessions" security feature.

   Until now the Settings card was advisory only: the client generated a STRING
   device id that never matched the numeric UserDevices.DeviceID, nothing ever
   registered a device, and "Log out" merely deleted a row without invalidating
   the JWT (30-day, no refresh, no revocation) — so a stolen phone stayed logged
   in regardless.

   This adds a genuine server-side session registry:
     * one row per successful login (per device),
     * the JWT carries that row's id in a "sid" claim,
     * every authenticated request checks the session is still active,
     * revoking a session makes that device's token stop working immediately.

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

IF OBJECT_ID('dbo.UserSessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserSessions (
        SessionId   INT IDENTITY(1,1) PRIMARY KEY,
        UserId      INT NOT NULL REFERENCES dbo.Users(UserID),
        -- The JWT's jti. Lets us tie a specific token to this row.
        TokenId     NVARCHAR(64)  NOT NULL,
        DeviceName  NVARCHAR(120) NULL,   -- "Samsung SM-S926B"
        Platform    NVARCHAR(40)  NULL,   -- android | ios | web
        AppVersion  NVARCHAR(30)  NULL,
        IpAddress   NVARCHAR(64)  NULL,
        CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
        LastSeenAt  DATETIME2 NOT NULL CONSTRAINT DF_UserSessions_LastSeenAt DEFAULT SYSUTCDATETIME(),
        RevokedAt   DATETIME2 NULL
    );
    CREATE INDEX IX_UserSessions_User ON dbo.UserSessions(UserId, RevokedAt);
END
GO

-- Register a new session at login; returns the new SessionId.
IF OBJECT_ID('dbo.sp_CreateUserSession', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CreateUserSession;
GO
CREATE PROCEDURE dbo.sp_CreateUserSession
    @UserId INT,
    @TokenId NVARCHAR(64),
    @DeviceName NVARCHAR(120) = NULL,
    @Platform NVARCHAR(40) = NULL,
    @AppVersion NVARCHAR(30) = NULL,
    @IpAddress NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.UserSessions (UserId, TokenId, DeviceName, Platform, AppVersion, IpAddress)
    VALUES (@UserId, @TokenId, @DeviceName, @Platform, @AppVersion, @IpAddress);
    SELECT CAST(SCOPE_IDENTITY() AS INT) AS SessionId;
END
GO

-- Active (non-revoked) sessions for the account, newest activity first.
IF OBJECT_ID('dbo.sp_GetUserSessions', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetUserSessions;
GO
CREATE PROCEDURE dbo.sp_GetUserSessions
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SessionId, UserId, DeviceName, Platform, AppVersion, IpAddress,
           CreatedAt, LastSeenAt
    FROM dbo.UserSessions
    WHERE UserId = @UserId AND RevokedAt IS NULL
    ORDER BY LastSeenAt DESC;
END
GO

-- Is this session still usable? Drives the per-request auth check.
IF OBJECT_ID('dbo.sp_IsSessionActive', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_IsSessionActive;
GO
CREATE PROCEDURE dbo.sp_IsSessionActive
    @SessionId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.UserSessions
        WHERE SessionId = @SessionId AND RevokedAt IS NULL) THEN 1 ELSE 0 END AS BIT) AS IsActive;
END
GO

-- Refresh "last active". Called at most once a minute per session by the API.
IF OBJECT_ID('dbo.sp_TouchUserSession', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_TouchUserSession;
GO
CREATE PROCEDURE dbo.sp_TouchUserSession
    @SessionId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.UserSessions SET LastSeenAt = SYSUTCDATETIME()
    WHERE SessionId = @SessionId AND RevokedAt IS NULL;
END
GO

-- Revoke ONE session. Scoped by UserId so a caller can never revoke someone
-- else's session even if they guess an id.
IF OBJECT_ID('dbo.sp_RevokeUserSession', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RevokeUserSession;
GO
CREATE PROCEDURE dbo.sp_RevokeUserSession
    @UserId INT, @SessionId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.UserSessions SET RevokedAt = SYSUTCDATETIME()
    WHERE SessionId = @SessionId AND UserId = @UserId AND RevokedAt IS NULL;
    SELECT @@ROWCOUNT AS Affected;
END
GO

-- "Log out everywhere else": revoke all of the user's sessions except the caller's.
IF OBJECT_ID('dbo.sp_RevokeOtherUserSessions', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RevokeOtherUserSessions;
GO
CREATE PROCEDURE dbo.sp_RevokeOtherUserSessions
    @UserId INT, @KeepSessionId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.UserSessions SET RevokedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND RevokedAt IS NULL AND SessionId <> @KeepSessionId;
    SELECT @@ROWCOUNT AS Affected;
END
GO
