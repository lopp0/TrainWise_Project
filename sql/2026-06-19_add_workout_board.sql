-- ============================================================================
-- A-3 : community Workout Board + competition Leaderboard.
-- Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
--
-- Feed/leaderboard are filtered by COUNTRY. Signup does not collect a country
-- and the demo is Israel-based, so Country defaults to 'IL'. IsOnLeaderboard
-- defaults to 1 here (opt-OUT) so the leaderboard has data for the demo; flip
-- the default to 0 for true opt-in.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Country')
    ALTER TABLE dbo.Users ADD Country NVARCHAR(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'IsOnLeaderboard')
    ALTER TABLE dbo.Users ADD IsOnLeaderboard BIT NOT NULL CONSTRAINT DF_Users_IsOnLeaderboard DEFAULT 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkoutPosts')
BEGIN
    CREATE TABLE dbo.WorkoutPosts (
        PostId        INT IDENTITY(1,1) PRIMARY KEY,
        UserID        INT NOT NULL REFERENCES dbo.Users(UserID),
        ActivityLogId INT NULL,
        PostType      NVARCHAR(20) NOT NULL DEFAULT 'record',  -- record | milestone | challenge
        Title         NVARCHAR(200) NOT NULL,
        Description   NVARCHAR(1000) NULL,
        MetricType    NVARCHAR(50) NULL,   -- distance_km | duration_min | load | calories
        MetricValue   FLOAT NULL,
        IsPublic      BIT NOT NULL DEFAULT 1,
        Country       NVARCHAR(100) NULL,
        CreatedAt     DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_WorkoutPosts_Country_Created ON dbo.WorkoutPosts (Country, CreatedAt DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkoutPostLikes')
BEGIN
    CREATE TABLE dbo.WorkoutPostLikes (
        PostId INT NOT NULL REFERENCES dbo.WorkoutPosts(PostId),
        UserID INT NOT NULL REFERENCES dbo.Users(UserID),
        CONSTRAINT PK_WorkoutPostLikes PRIMARY KEY (PostId, UserID)
    );
END
GO
