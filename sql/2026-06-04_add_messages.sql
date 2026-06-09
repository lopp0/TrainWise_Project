-- =====================================================================
-- TrainWise migration: coach <-> trainee chat (feature #6)
-- Date: 2026-06-04
-- Run on the Azure SQL database the API connects to (SSMS connected to
-- trainwiseadmin.database.windows.net / TrainWiseDB).
--
-- Adds: Messages table + 5 stored procedures. Idempotent — safe to
-- re-run (table guarded by IF NOT EXISTS, procs use CREATE OR ALTER).
-- Chat is user<->user: SenderID / ReceiverID are both Users.UserID
-- (a coach's UserID is their Users row, not their CoachID).
-- =====================================================================

-- 1) Messages table -----------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'Messages' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.Messages (
        MessageID  INT IDENTITY(1,1) NOT NULL,
        SenderID   INT NOT NULL,
        ReceiverID INT NOT NULL,
        [Text]     NVARCHAR(1000) NOT NULL,
        -- Stored in UTC; the app appends 'Z' and renders in Asia/Jerusalem.
        SentAt     DATETIME2 NOT NULL CONSTRAINT DF_Messages_SentAt DEFAULT (SYSUTCDATETIME()),
        IsSeen     BIT NOT NULL CONSTRAINT DF_Messages_IsSeen DEFAULT (0),
        CONSTRAINT PK_Messages PRIMARY KEY CLUSTERED (MessageID ASC),
        CONSTRAINT FK_Messages_Sender   FOREIGN KEY (SenderID)   REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverID) REFERENCES dbo.Users(UserID)
    );

    -- Conversation lookups filter by the (sender, receiver) pair ordered by time.
    CREATE INDEX IX_Messages_Pair ON dbo.Messages (SenderID, ReceiverID, SentAt);
    -- Unread badge counts filter by receiver + unseen.
    CREATE INDEX IX_Messages_Unread ON dbo.Messages (ReceiverID, IsSeen);
END
GO

-- 2) sp_InsertMessage — insert + return the materialized row -------------
CREATE OR ALTER PROCEDURE dbo.sp_InsertMessage
    @SenderID   INT,
    @ReceiverID INT,
    @Text       NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Messages (SenderID, ReceiverID, [Text], SentAt, IsSeen)
    VALUES (@SenderID, @ReceiverID, @Text, SYSUTCDATETIME(), 0);

    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen
    FROM dbo.Messages
    WHERE MessageID = SCOPE_IDENTITY();
END
GO

-- 3) sp_GetConversation — full thread between two users, oldest first ----
CREATE OR ALTER PROCEDURE dbo.sp_GetConversation
    @UserA INT,
    @UserB INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen
    FROM dbo.Messages
    WHERE (SenderID = @UserA AND ReceiverID = @UserB)
       OR (SenderID = @UserB AND ReceiverID = @UserA)
    ORDER BY SentAt ASC, MessageID ASC;
END
GO

-- 4) sp_MarkMessagesSeen — receiver opened the chat ----------------------
CREATE OR ALTER PROCEDURE dbo.sp_MarkMessagesSeen
    @SenderID   INT,
    @ReceiverID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Messages
    SET IsSeen = 1
    WHERE SenderID = @SenderID AND ReceiverID = @ReceiverID AND IsSeen = 0;
END
GO

-- 5) sp_GetUnreadMessageCount — badge source -----------------------------
CREATE OR ALTER PROCEDURE dbo.sp_GetUnreadMessageCount
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) FROM dbo.Messages WHERE ReceiverID = @UserID AND IsSeen = 0;
END
GO

-- 6) sp_GetCoachesForTrainee — reverse link for the trainee-side entry ----
--    Returns the coach's Users row id (CoachUserID) so the trainee can chat.
CREATE OR ALTER PROCEDURE dbo.sp_GetCoachesForTrainee
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CoachID,
           c.UserID AS CoachUserID,
           u.FullName,
           u.Email,
           u.ProfileImagePath
    FROM dbo.CoachTrainees ct
    JOIN dbo.Coaches c ON ct.CoachID = c.CoachID
    JOIN dbo.Users  u ON c.UserID   = u.UserID
    WHERE ct.UserID = @UserID;
END
GO
