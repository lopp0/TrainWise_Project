/* ============================================================================
   2026-07-21 — #133 Assigned training programs.

   A coach builds a reusable multi-week program (TrainingPrograms + its
   ProgramWorkouts template rows) and assigns it to ONE trainee
   (ProgramAssignments). Assigning FANS OUT the template into the trainee's
   existing dbo.PlannedWorkouts (so the training calendar shows it for free);
   the generated rows carry SourceAssignmentId so an unassign can remove exactly
   them. Each assignment also has a per-program discussion thread
   (ProgramMessages + reactions + reads), mirroring the event group chat
   (2026-07-19_event_chat_full.sql) so the client can reuse the same chat UI.

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

------------------------------------------------------------- programs ---------
IF OBJECT_ID('dbo.TrainingPrograms', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainingPrograms (
        ProgramID     INT IDENTITY(1,1) PRIMARY KEY,
        CoachUserID   INT NOT NULL REFERENCES dbo.Users(UserID),
        Name          NVARCHAR(120)  NOT NULL,
        Description   NVARCHAR(1000) NULL,
        DurationWeeks INT NOT NULL CONSTRAINT DF_TrainingPrograms_Weeks DEFAULT 4,
        CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_TrainingPrograms_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_TrainingPrograms_Coach ON dbo.TrainingPrograms(CoachUserID);
END
GO

-- Template rows: which activity on which day of which week.
-- DayOfWeek is 0=Mon .. 6=Sun (matches the builder UI; converted to a real date
-- at assign time as StartDate + (WeekNumber-1)*7 + DayOfWeek).
IF OBJECT_ID('dbo.ProgramWorkouts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramWorkouts (
        ProgramWorkoutID INT IDENTITY(1,1) PRIMARY KEY,
        ProgramID        INT NOT NULL REFERENCES dbo.TrainingPrograms(ProgramID) ON DELETE CASCADE,
        WeekNumber       INT NOT NULL,      -- 1-based
        DayOfWeek        INT NOT NULL,      -- 0=Mon .. 6=Sun
        ActivityTypeID   INT NULL,
        Duration         INT NULL,          -- minutes
        Distance         FLOAT NULL,        -- km
        [Load]           FLOAT NULL,        -- target session load
        Notes            NVARCHAR(500) NULL
    );
    CREATE INDEX IX_ProgramWorkouts_Program ON dbo.ProgramWorkouts(ProgramID);
END
GO

------------------------------------------------------------ assignments -------
-- ProgramID is NO ACTION (not cascade): a template with live assignments can't
-- be silently deleted out from under a trainee. The BL unassigns first.
IF OBJECT_ID('dbo.ProgramAssignments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramAssignments (
        AssignmentID  INT IDENTITY(1,1) PRIMARY KEY,
        ProgramID     INT NOT NULL REFERENCES dbo.TrainingPrograms(ProgramID),
        TraineeUserID INT NOT NULL REFERENCES dbo.Users(UserID),
        CoachUserID   INT NOT NULL REFERENCES dbo.Users(UserID),
        StartDate     DATE NOT NULL,
        Status        NVARCHAR(20) NOT NULL CONSTRAINT DF_ProgramAssignments_Status DEFAULT 'active',
        AssignedAt    DATETIME2 NOT NULL CONSTRAINT DF_ProgramAssignments_AssignedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ProgramAssignments_Trainee ON dbo.ProgramAssignments(TraineeUserID);
    CREATE INDEX IX_ProgramAssignments_Program ON dbo.ProgramAssignments(ProgramID);
END
GO

-- Link generated calendar rows back to the assignment that created them, so an
-- unassign deletes exactly those PlannedWorkouts and nothing the user added.
IF COL_LENGTH('dbo.PlannedWorkouts', 'SourceAssignmentId') IS NULL
    ALTER TABLE dbo.PlannedWorkouts ADD SourceAssignmentId INT NULL;
GO

--------------------------------------------------- per-assignment chat --------
-- Mirrors dbo.EventChatMessages: text OR media (image/video/audio), reactions
-- and read receipts. The Users FKs are NO ACTION on purpose — ProgramMessages
-- already cascades from ProgramAssignments, so cascading from Users too would
-- give SQL Server multiple cascade paths and fail at CREATE (same reason as the
-- event chat).
IF OBJECT_ID('dbo.ProgramMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramMessages (
        MessageId    INT IDENTITY(1,1) PRIMARY KEY,
        AssignmentId INT NOT NULL REFERENCES dbo.ProgramAssignments(AssignmentID) ON DELETE CASCADE,
        SenderId     INT NOT NULL REFERENCES dbo.Users(UserID),
        [Text]       NVARCHAR(1000) NULL,
        ImagePath    NVARCHAR(300) NULL,
        VideoPath    NVARCHAR(300) NULL,
        AudioPath    NVARCHAR(300) NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_ProgramMessages_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ProgramMessages_Assignment ON dbo.ProgramMessages(AssignmentId, CreatedAt);
END
GO

IF OBJECT_ID('dbo.ProgramMessageReactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramMessageReactions (
        MessageId INT NOT NULL REFERENCES dbo.ProgramMessages(MessageId) ON DELETE CASCADE,
        UserId    INT NOT NULL REFERENCES dbo.Users(UserID),
        Emoji     NVARCHAR(16) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProgMsgReactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ProgramMessageReactions PRIMARY KEY (MessageId, UserId)
    );
END
GO

IF OBJECT_ID('dbo.ProgramMessageReads', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramMessageReads (
        MessageId INT NOT NULL REFERENCES dbo.ProgramMessages(MessageId) ON DELETE CASCADE,
        UserId    INT NOT NULL REFERENCES dbo.Users(UserID),
        ReadAt    DATETIME2 NOT NULL CONSTRAINT DF_ProgMsgReads_ReadAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ProgramMessageReads PRIMARY KEY (MessageId, UserId)
    );
END
GO
