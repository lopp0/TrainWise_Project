/* ============================================================================
   2026-07-15 — Workouts & Wearables batch (idempotent; safe to re-run).
   Run on BOTH local SQL Express (TrainWise) and Azure SQL (TrainWiseDB).

   Features in this migration:
     #139 Voice messages          -> Messages.AudioPath  (+ proc updates)
     #135 Video form-check         -> Messages.VideoPath  (+ proc updates)
     #119 Workout templates        -> WorkoutTemplates
     #132 Hydration & nutrition     -> NutritionLog

   (#123 export, #166 barcode, #146 gym search, #129 sleep, #130 HRV need no
    schema — they are client-side / reuse the existing Gyms table.)
   ============================================================================ */

USE [TrainWise];
GO

/* ---- #139/#135: audio + video message paths ------------------------------ */
IF COL_LENGTH('dbo.Messages', 'AudioPath') IS NULL
    ALTER TABLE dbo.Messages ADD AudioPath NVARCHAR(300) NULL;
GO
IF COL_LENGTH('dbo.Messages', 'VideoPath') IS NULL
    ALTER TABLE dbo.Messages ADD VideoPath NVARCHAR(300) NULL;
GO

-- sp_InsertMessage — now also carries AudioPath (#139) + VideoPath (#135).
-- Media-only messages store an empty Text (column is NOT NULL).
CREATE OR ALTER PROCEDURE dbo.sp_InsertMessage
    @SenderID   INT,
    @ReceiverID INT,
    @Text       NVARCHAR(1000),
    @ImagePath  NVARCHAR(300) = NULL,
    @AudioPath  NVARCHAR(300) = NULL,
    @VideoPath  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Messages (SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath, AudioPath, VideoPath)
    VALUES (@SenderID, @ReceiverID, @Text, SYSUTCDATETIME(), 0, @ImagePath, @AudioPath, @VideoPath);

    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath, AudioPath, VideoPath
    FROM dbo.Messages
    WHERE MessageID = SCOPE_IDENTITY();
END
GO

-- sp_GetConversation — include the media paths.
CREATE OR ALTER PROCEDURE dbo.sp_GetConversation
    @UserA INT,
    @UserB INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MessageID, SenderID, ReceiverID, [Text], SentAt, IsSeen, ImagePath, AudioPath, VideoPath
    FROM dbo.Messages
    WHERE (SenderID = @UserA AND ReceiverID = @UserB)
       OR (SenderID = @UserB AND ReceiverID = @UserA)
    ORDER BY SentAt ASC, MessageID ASC;
END
GO

/* ---- #181: workout share via deep link ----------------------------------- */
-- Only workouts a user has explicitly shared are exposed by the public read
-- endpoint (which returns non-sensitive fields only).
IF COL_LENGTH('dbo.ActivityLogs', 'IsShared') IS NULL
    ALTER TABLE dbo.ActivityLogs ADD IsShared BIT NOT NULL CONSTRAINT DF_ActivityLogs_IsShared DEFAULT 0;
GO

/* ---- #119: reusable workout templates / favorites ------------------------ */
IF OBJECT_ID('dbo.WorkoutTemplates', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkoutTemplates (
        TemplateID     INT IDENTITY(1,1) PRIMARY KEY,
        UserID         INT NOT NULL,
        Name           NVARCHAR(80) NOT NULL,
        ActivityTypeID INT NOT NULL,
        Duration       INT NOT NULL,              -- minutes
        ExertionLevel  TINYINT NOT NULL,          -- 1..10
        TargetValue    FLOAT NULL,                -- optional distance/reps target
        CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_WorkoutTemplates_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_WorkoutTemplates_User FOREIGN KEY (UserID)
            REFERENCES dbo.Users(UserID) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkoutTemplates_User ON dbo.WorkoutTemplates(UserID, CreatedAt);
END
GO

/* ---- #132: hydration & nutrition daily log ------------------------------- */
-- One row per logged item (a meal, a snack, or a water entry). Kind = 'food'
-- or 'water'; Calories used for food, WaterMl used for water.
IF OBJECT_ID('dbo.NutritionLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NutritionLog (
        EntryID    INT IDENTITY(1,1) PRIMARY KEY,
        UserID     INT NOT NULL,
        LoggedAt   DATETIME2 NOT NULL CONSTRAINT DF_NutritionLog_LoggedAt DEFAULT SYSUTCDATETIME(),
        Kind       NVARCHAR(10) NOT NULL,     -- 'food' | 'water'
        Name       NVARCHAR(120) NULL,        -- food label (from barcode #166 or manual)
        Calories   INT NULL,                  -- kcal for food
        WaterMl    INT NULL,                  -- ml for water
        Barcode    NVARCHAR(32) NULL,         -- Open Food Facts code (#166), if scanned
        CONSTRAINT FK_NutritionLog_User FOREIGN KEY (UserID)
            REFERENCES dbo.Users(UserID) ON DELETE CASCADE
    );
    CREATE INDEX IX_NutritionLog_User ON dbo.NutritionLog(UserID, LoggedAt);
END
GO
