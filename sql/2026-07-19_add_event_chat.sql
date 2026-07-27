/* ============================================================================
   ⚠️ SUPERSEDED BY sql/2026-07-19_event_chat_full.sql — DO NOT RE-RUN THIS FILE
   AFTER THAT ONE.

   This script creates the ORIGINAL 3-parameter sp_PostEventMessage. The app now
   sends 6 parameters (text + image + video + audio), so re-running this file
   after the full migration downgrades the proc and every send fails with
   "Too many arguments are specified for procedure sp_PostEventMessage".

   The guards below make this file a no-op once the full migration has run.
   If you hit that error: just run 2026-07-19_event_chat_full.sql again.
   ============================================================================ */

/* ============================================================================
   2026-07-19 — #145 Group event chat (device-test feedback #3):
   attendees of an event can discuss (time / place / links) in a shared thread.
   Membership = the event creator + anyone who RSVP'd 'going' or 'maybe'.

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   NOTE: new procs use DROP + CREATE (some servers resolve CREATE OR ALTER for a
   not-yet-existing object as ALTER → Msg 208). See lessons.md 2026-07-19.
   ============================================================================ */

IF OBJECT_ID('dbo.EventChatMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventChatMessages (
        MessageId INT IDENTITY(1,1) PRIMARY KEY,
        EventId   INT NOT NULL REFERENCES dbo.Events(EventID) ON DELETE CASCADE,
        SenderId  INT NOT NULL REFERENCES dbo.Users(UserID),
        [Text]    NVARCHAR(1000) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EventChatMessages_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_EventChatMessages_Event ON dbo.EventChatMessages(EventId, CreatedAt);
END
GO

-- GUARD: skip entirely once the full migration has added the media columns,
-- otherwise this would replace the 6-parameter proc with the old 3-parameter one.
-- CREATE PROCEDURE must be the first statement in its batch, hence EXEC(...).
IF COL_LENGTH('dbo.EventChatMessages', 'ImagePath') IS NULL
BEGIN
    IF OBJECT_ID('dbo.sp_PostEventMessage', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_PostEventMessage;
    EXEC('
CREATE PROCEDURE dbo.sp_PostEventMessage
    @EventId INT, @SenderId INT, @Text NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.EventChatMessages (EventId, SenderId, [Text]) VALUES (@EventId, @SenderId, @Text);
    SELECT SCOPE_IDENTITY() AS MessageId;
END');
END
GO

IF COL_LENGTH('dbo.EventChatMessages', 'ImagePath') IS NULL
BEGIN
    IF OBJECT_ID('dbo.sp_GetEventMessages', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetEventMessages;
    EXEC('
CREATE PROCEDURE dbo.sp_GetEventMessages
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MessageId, m.EventId, m.SenderId,
           u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
           m.[Text], m.CreatedAt
    FROM dbo.EventChatMessages m
    JOIN dbo.Users u ON u.UserID = m.SenderId
    WHERE m.EventId = @EventId
    ORDER BY m.CreatedAt ASC;
END');
END
GO

-- (original un-guarded bodies kept below as comments for reference)
/*
CREATE PROCEDURE dbo.sp_GetEventMessages
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MessageId, m.EventId, m.SenderId,
           u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
           m.[Text], m.CreatedAt
    FROM dbo.EventChatMessages m
    JOIN dbo.Users u ON u.UserID = m.SenderId
    WHERE m.EventId = @EventId
    ORDER BY m.CreatedAt ASC;
END
*/

-- 1 when the user may access the event chat (creator or a going/maybe RSVP).
IF OBJECT_ID('dbo.sp_IsEventParticipant', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_IsEventParticipant;
GO
CREATE PROCEDURE dbo.sp_IsEventParticipant
    @EventId INT, @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Events e WHERE e.EventID = @EventId AND e.CreatorID = @UserId)
                       OR EXISTS (SELECT 1 FROM dbo.EventRSVPs r WHERE r.EventID = @EventId AND r.UserID = @UserId AND r.Status IN ('going','maybe'))
                     THEN 1 ELSE 0 END AS BIT) AS IsParticipant;
END
GO
