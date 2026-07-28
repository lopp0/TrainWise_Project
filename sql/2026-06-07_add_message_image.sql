-- =====================================================================
-- TrainWise migration: image messages in coach <-> trainee chat (#9)
-- Date: 2026-06-07
-- Run on the DB the API connects to (local SQL Express "TrainWise", or a
-- future Azure/Oracle DB). Idempotent — safe to re-run.
--
-- Adds Messages.ImagePath and updates sp_InsertMessage / sp_GetConversation
-- to carry it. Image-only messages store an empty Text (column is NOT NULL).
-- =====================================================================

USE [TrainWise];
GO

-- 1) ImagePath column ---------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Messages') AND name = 'ImagePath'
)
BEGIN
    ALTER TABLE dbo.Messages ADD ImagePath NVARCHAR(300) NULL;
END
GO

-- 2) sp_InsertMessage — accept + return ImagePath -----------------------
CREATE OR ALTER PROCEDURE dbo.sp_InsertMessage
    @SenderID   INT,
    @ReceiverID INT,
    @Text       NVARCHAR(1000),
    @ImagePath  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Messages (SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath)
    VALUES (@SenderID, @ReceiverID, @Text, SYSUTCDATETIME(), 0, @ImagePath);

    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath
    FROM dbo.Messages
    WHERE MessageID = SCOPE_IDENTITY();
END
GO

-- 3) sp_GetConversation — include ImagePath -----------------------------
CREATE OR ALTER PROCEDURE dbo.sp_GetConversation
    @UserA INT,
    @UserB INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath
    FROM dbo.Messages
    WHERE (SenderID = @UserA AND ReceiverID = @UserB)
       OR (SenderID = @UserB AND ReceiverID = @UserA)
    ORDER BY SentAt ASC, MessageID ASC;
END
GO
