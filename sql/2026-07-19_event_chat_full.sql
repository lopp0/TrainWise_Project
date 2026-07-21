/* ============================================================================
   2026-07-19 — device-test #7: bring the EVENT GROUP CHAT up to full parity with
   the 1:1 chat — images, videos, voice notes, emoji reactions and read receipts.

   Adds to dbo.EventChatMessages: ImagePath / VideoPath / AudioPath, and makes
   [Text] nullable (a message can now be media-only, exactly like the 1:1 chat
   where SendMessageRequest.Text is nullable).

   New tables:
     dbo.EventMessageReactions  one emoji per user per message (toggle)
     dbo.EventMessageReads      one row per user per message (read receipts)

   FK note: the Users FKs are deliberately NO ACTION. EventChatMessages already
   cascades from Events, so cascading from Users as well would give SQL Server
   multiple cascade paths and fail at CREATE.

   Run AFTER 2026-07-19_add_event_chat.sql. Idempotent.
   Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

--------------------------------------------------------------- base table ----
-- Self-contained on purpose: this creates the table too, so running THIS FILE
-- ALONE is always enough. (If 2026-07-19_add_event_chat.sql is ever re-run after
-- this one it recreates the OLD 3-parameter sp_PostEventMessage and the app
-- fails with "Too many arguments are specified for procedure sp_PostEventMessage"
-- — just re-run this file to repair it.)
IF OBJECT_ID('dbo.EventChatMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventChatMessages (
        MessageId INT IDENTITY(1,1) PRIMARY KEY,
        EventId   INT NOT NULL REFERENCES dbo.Events(EventID) ON DELETE CASCADE,
        SenderId  INT NOT NULL REFERENCES dbo.Users(UserID),
        [Text]    NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EventChatMessages_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_EventChatMessages_Event ON dbo.EventChatMessages(EventId, CreatedAt);
END
GO

------------------------------------------------------------------- columns ----
IF COL_LENGTH('dbo.EventChatMessages', 'ImagePath') IS NULL
    ALTER TABLE dbo.EventChatMessages ADD ImagePath NVARCHAR(300) NULL;
GO
IF COL_LENGTH('dbo.EventChatMessages', 'VideoPath') IS NULL
    ALTER TABLE dbo.EventChatMessages ADD VideoPath NVARCHAR(300) NULL;
GO
IF COL_LENGTH('dbo.EventChatMessages', 'AudioPath') IS NULL
    ALTER TABLE dbo.EventChatMessages ADD AudioPath NVARCHAR(300) NULL;
GO

-- A media-only message has no text, so [Text] must allow NULL.
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.EventChatMessages')
             AND name = 'Text' AND is_nullable = 0)
    ALTER TABLE dbo.EventChatMessages ALTER COLUMN [Text] NVARCHAR(1000) NULL;
GO

-------------------------------------------------------------------- tables ----
IF OBJECT_ID('dbo.EventMessageReactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventMessageReactions (
        MessageId INT NOT NULL
            REFERENCES dbo.EventChatMessages(MessageId) ON DELETE CASCADE,
        UserId    INT NOT NULL REFERENCES dbo.Users(UserID),
        Emoji     NVARCHAR(16) NOT NULL,
        CreatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_EventMsgReactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_EventMessageReactions PRIMARY KEY (MessageId, UserId)
    );
END
GO

IF OBJECT_ID('dbo.EventMessageReads', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventMessageReads (
        MessageId INT NOT NULL
            REFERENCES dbo.EventChatMessages(MessageId) ON DELETE CASCADE,
        UserId    INT NOT NULL REFERENCES dbo.Users(UserID),
        ReadAt    DATETIME2 NOT NULL
            CONSTRAINT DF_EventMsgReads_ReadAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_EventMessageReads PRIMARY KEY (MessageId, UserId)
    );
END
GO

--------------------------------------------------------------------- procs ----
-- Post a message. Any of text / image / video / audio may be supplied; the BL
-- rejects a message where all four are empty. Returns the full inserted row so
-- the client can append it without a re-fetch.
IF OBJECT_ID('dbo.sp_PostEventMessage', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_PostEventMessage;
GO
CREATE PROCEDURE dbo.sp_PostEventMessage
    @EventId INT,
    @SenderId INT,
    @Text NVARCHAR(1000) = NULL,
    @ImagePath NVARCHAR(300) = NULL,
    @VideoPath NVARCHAR(300) = NULL,
    @AudioPath NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.EventChatMessages (EventId, SenderId, [Text], ImagePath, VideoPath, AudioPath)
    VALUES (@EventId, @SenderId, @Text, @ImagePath, @VideoPath, @AudioPath);

    DECLARE @NewId INT = SCOPE_IDENTITY();

    SELECT m.MessageId, m.EventId, m.SenderId,
           u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
           m.[Text], m.ImagePath, m.VideoPath, m.AudioPath, m.CreatedAt,
           0 AS SeenCount
    FROM dbo.EventChatMessages m
    JOIN dbo.Users u ON u.UserID = m.SenderId
    WHERE m.MessageId = @NewId;
END
GO

-- All messages in an event, oldest first, with a read-receipt count (readers
-- other than the sender) so the sender can show "seen by N".
IF OBJECT_ID('dbo.sp_GetEventMessages', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetEventMessages;
GO
CREATE PROCEDURE dbo.sp_GetEventMessages
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MessageId, m.EventId, m.SenderId,
           u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
           m.[Text], m.ImagePath, m.VideoPath, m.AudioPath, m.CreatedAt,
           (SELECT COUNT(*) FROM dbo.EventMessageReads r
             WHERE r.MessageId = m.MessageId AND r.UserId <> m.SenderId) AS SeenCount
    FROM dbo.EventChatMessages m
    JOIN dbo.Users u ON u.UserID = m.SenderId
    WHERE m.EventId = @EventId
    ORDER BY m.CreatedAt ASC, m.MessageId ASC;
END
GO

-- Mark every message in the event that this user did NOT send as read by them.
IF OBJECT_ID('dbo.sp_MarkEventMessagesSeen', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_MarkEventMessagesSeen;
GO
CREATE PROCEDURE dbo.sp_MarkEventMessagesSeen
    @EventId INT, @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.EventMessageReads (MessageId, UserId)
    SELECT m.MessageId, @UserId
    FROM dbo.EventChatMessages m
    WHERE m.EventId = @EventId
      AND m.SenderId <> @UserId
      AND NOT EXISTS (SELECT 1 FROM dbo.EventMessageReads r
                       WHERE r.MessageId = m.MessageId AND r.UserId = @UserId);
END
GO

-- Toggle an emoji reaction: same emoji again removes it, a different emoji
-- replaces it (one reaction per user per message, like the 1:1 chat).
IF OBJECT_ID('dbo.sp_ReactEventMessage', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ReactEventMessage;
GO
CREATE PROCEDURE dbo.sp_ReactEventMessage
    @MessageId INT, @UserId INT, @Emoji NVARCHAR(16)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Existing NVARCHAR(16) = (
        SELECT Emoji FROM dbo.EventMessageReactions
        WHERE MessageId = @MessageId AND UserId = @UserId);

    IF @Existing IS NULL
        INSERT INTO dbo.EventMessageReactions (MessageId, UserId, Emoji)
        VALUES (@MessageId, @UserId, @Emoji);
    ELSE IF @Existing = @Emoji
        DELETE FROM dbo.EventMessageReactions
        WHERE MessageId = @MessageId AND UserId = @UserId;
    ELSE
        UPDATE dbo.EventMessageReactions SET Emoji = @Emoji
        WHERE MessageId = @MessageId AND UserId = @UserId;
END
GO

-- Every reaction on every message of the event (client groups by MessageId).
IF OBJECT_ID('dbo.sp_GetEventReactions', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetEventReactions;
GO
CREATE PROCEDURE dbo.sp_GetEventReactions
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT rx.MessageId, rx.UserId, rx.Emoji
    FROM dbo.EventMessageReactions rx
    JOIN dbo.EventChatMessages m ON m.MessageId = rx.MessageId
    WHERE m.EventId = @EventId;
END
GO
