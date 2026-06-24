-- ============================================================================
-- A-5 : Personal Records + Achievement Badges.
-- Idempotent. Run on BOTH local SQL Express (TrainWise) and Azure SQL.
-- The records/badges CRUD is plain parameterized SQL in RecordsDAL.cs, so this
-- script only creates the two tables.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PersonalRecords')
BEGIN
    CREATE TABLE dbo.PersonalRecords (
        RecordId       INT IDENTITY(1,1) PRIMARY KEY,
        UserID         INT NOT NULL,
        ActivityTypeId INT NULL,                 -- NULL = all-activity record
        MetricType     NVARCHAR(50) NOT NULL,    -- longest_distance_km | longest_duration_min | highest_load | most_weekly_sessions | longest_streak_days
        RecordValue    FLOAT NOT NULL,
        AchievedAt     DATETIME NOT NULL,
        LinkedLogId    INT NULL,
        CONSTRAINT FK_PersonalRecords_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
    -- One row per (user, metric) for all-activity records.
    CREATE UNIQUE INDEX UX_PersonalRecords_User_Metric
        ON dbo.PersonalRecords (UserID, MetricType)
        WHERE ActivityTypeId IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EarnedBadges')
BEGIN
    CREATE TABLE dbo.EarnedBadges (
        BadgeId   INT IDENTITY(1,1) PRIMARY KEY,
        UserID    INT NOT NULL,
        BadgeKey  NVARCHAR(100) NOT NULL,        -- e.g. first_workout, streak_7, distance_10k, load_gold
        EarnedAt  DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EarnedBadges_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT UQ_EarnedBadges_User_Key UNIQUE (UserID, BadgeKey)
    );
END
GO
