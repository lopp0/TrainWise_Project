-- ============================================================================
-- A-4 : Training Calendar — planned workouts a user (or their coach) schedules.
-- Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PlannedWorkouts')
BEGIN
    CREATE TABLE dbo.PlannedWorkouts (
        PlanId          INT IDENTITY(1,1) PRIMARY KEY,
        UserID          INT NOT NULL REFERENCES dbo.Users(UserID),
        CreatedByCoach  INT NULL REFERENCES dbo.Users(UserID),  -- NULL = user planned it
        ActivityTypeId  INT NULL,
        PlannedDate     DATE NOT NULL,
        PlannedDuration INT NULL,        -- minutes
        PlannedDistance FLOAT NULL,      -- km
        PlannedLoad     FLOAT NULL,      -- target session load
        Notes           NVARCHAR(500) NULL,
        IsCompleted     BIT NOT NULL DEFAULT 0,
        LinkedLogId     INT NULL,        -- the actual ActivityLog logged that day
        CreatedAt       DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_PlannedWorkouts_User_Date ON dbo.PlannedWorkouts (UserID, PlannedDate);
END
GO
