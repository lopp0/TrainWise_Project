/* ============================================================================
   2026-06-28 — Green-batch schema (idempotent; safe to re-run).
   Run on BOTH local SQL Express (TrainWise) and Azure SQL (TrainWiseDB).

   Features:
     #124 Per-workout notes + photos     -> ActivityLogs.Notes / .PhotoPath
     #127 Daily pain-level tracking       -> InjuryPainLog
     #131 Weight & body-composition       -> BodyMeasurements
     #138 Typing indicator                -> MessageTyping
     #140 Message reactions (emoji)       -> MessageReactions
     #171 Kudos / cheers on workouts      -> WorkoutKudos
   (#170 friends-only leaderboard needs no schema — it reuses Friendships +
    Users.IsOnLeaderboard, both already present.)
   ============================================================================ */

/* ---- #124: per-workout note + photo -------------------------------------- */
IF COL_LENGTH('dbo.ActivityLogs', 'Notes') IS NULL
    ALTER TABLE dbo.ActivityLogs ADD Notes NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.ActivityLogs', 'PhotoPath') IS NULL
    ALTER TABLE dbo.ActivityLogs ADD PhotoPath NVARCHAR(300) NULL;
GO

/* ---- #127: daily pain-level log per injury ------------------------------- */
IF OBJECT_ID('dbo.InjuryPainLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InjuryPainLog (
        PainLogID  INT IDENTITY(1,1) PRIMARY KEY,
        InjuryID   INT NOT NULL,
        LoggedAt   DATETIME2 NOT NULL CONSTRAINT DF_InjuryPainLog_LoggedAt DEFAULT SYSUTCDATETIME(),
        Level      INT NOT NULL,          -- 1..10
        Note       NVARCHAR(300) NULL,
        CONSTRAINT FK_InjuryPainLog_Injury FOREIGN KEY (InjuryID)
            REFERENCES dbo.InjuriesReports(InjuryID) ON DELETE CASCADE
    );
    CREATE INDEX IX_InjuryPainLog_Injury ON dbo.InjuryPainLog(InjuryID, LoggedAt);
END
GO

/* ---- #131: body-measurement tracking ------------------------------------- */
IF OBJECT_ID('dbo.BodyMeasurements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BodyMeasurements (
        MeasurementID INT IDENTITY(1,1) PRIMARY KEY,
        UserID        INT NOT NULL,
        MeasuredAt    DATETIME2 NOT NULL CONSTRAINT DF_BodyMeasurements_MeasuredAt DEFAULT SYSUTCDATETIME(),
        Weight        FLOAT NOT NULL,        -- kg
        BodyFat       FLOAT NULL,            -- optional %
        CONSTRAINT FK_BodyMeasurements_User FOREIGN KEY (UserID)
            REFERENCES dbo.Users(UserID) ON DELETE CASCADE
    );
    CREATE INDEX IX_BodyMeasurements_User ON dbo.BodyMeasurements(UserID, MeasuredAt);
END
GO

/* ---- #138: typing indicator (one row per from->to pair) ------------------ */
IF OBJECT_ID('dbo.MessageTyping', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MessageTyping (
        FromUserID INT NOT NULL,
        ToUserID   INT NOT NULL,
        UpdatedAt  DATETIME2 NOT NULL CONSTRAINT DF_MessageTyping_UpdatedAt DEFAULT SYSUTCDATETIME(),
        IsTyping   BIT NOT NULL CONSTRAINT DF_MessageTyping_IsTyping DEFAULT 0,
        CONSTRAINT PK_MessageTyping PRIMARY KEY (FromUserID, ToUserID)
    );
END
GO

/* ---- #140: emoji reactions on messages (one per user per message) -------- */
IF OBJECT_ID('dbo.MessageReactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MessageReactions (
        MessageID INT NOT NULL,
        UserID    INT NOT NULL,
        Emoji     NVARCHAR(16) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MessageReactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_MessageReactions PRIMARY KEY (MessageID, UserID),
        CONSTRAINT FK_MessageReactions_Message FOREIGN KEY (MessageID)
            REFERENCES dbo.Messages(MessageID) ON DELETE CASCADE
    );
END
GO

/* ---- #171: kudos ("cheers") on workouts (one per user per workout) ------- */
IF OBJECT_ID('dbo.WorkoutKudos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkoutKudos (
        LogID      INT NOT NULL,            -- ActivityLogs.ActivityID
        FromUserID INT NOT NULL,
        CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_WorkoutKudos_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_WorkoutKudos PRIMARY KEY (LogID, FromUserID)
    );
    CREATE INDEX IX_WorkoutKudos_Log ON dbo.WorkoutKudos(LogID);
END
GO
