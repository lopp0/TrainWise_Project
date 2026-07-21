/* ============================================================================
   2026-07-17 — Community medium batch:
     #142 Friend challenges      (Challenges + ChallengeParticipants)
     #145 Group runs / events    (Events + EventRSVPs)
     #169 Coach marketplace+revs  (CoachReviews + marketplace proc)
     #144 Activity feed           (proc only — reads friends' logs + board posts)

   Idempotent (IF OBJECT_ID guards + CREATE OR ALTER). Run on local SQL Express
   (TrainWise) AND Azure SQL. Standings/feed are COMPUTED from ActivityLogs so no
   denormalised counters go stale.
   ============================================================================ */

-- =====================================================================
-- #142  FRIEND CHALLENGES
-- =====================================================================
IF OBJECT_ID('dbo.Challenges', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Challenges (
        ChallengeID  INT IDENTITY(1,1) PRIMARY KEY,
        CreatorID    INT NOT NULL REFERENCES dbo.Users(UserID),
        Title        NVARCHAR(120) NOT NULL,
        Metric       NVARCHAR(20)  NOT NULL DEFAULT 'load',   -- load | workouts | distance
        StartDate    DATE NOT NULL,
        EndDate      DATE NOT NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Challenges_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Challenges_Dates ON dbo.Challenges(EndDate);
END
GO

IF OBJECT_ID('dbo.ChallengeParticipants', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChallengeParticipants (
        ChallengeID INT NOT NULL REFERENCES dbo.Challenges(ChallengeID) ON DELETE CASCADE,
        UserID      INT NOT NULL REFERENCES dbo.Users(UserID),
        JoinedAt    DATETIME2 NOT NULL CONSTRAINT DF_ChallengeParticipants_JoinedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ChallengeParticipants PRIMARY KEY (ChallengeID, UserID)
    );
END
GO

-- Create a challenge and auto-enrol the creator + an initial set of invitees.
CREATE OR ALTER PROCEDURE dbo.sp_CreateChallenge
    @CreatorID INT,
    @Title     NVARCHAR(120),
    @Metric    NVARCHAR(20),
    @StartDate DATE,
    @EndDate   DATE,
    @InviteeCsv NVARCHAR(MAX) = NULL   -- comma-separated friend UserIDs
AS
BEGIN
    SET NOCOUNT ON;
    IF @Metric NOT IN ('load','workouts','distance') SET @Metric = 'load';
    INSERT INTO dbo.Challenges (CreatorID, Title, Metric, StartDate, EndDate)
    VALUES (@CreatorID, LTRIM(RTRIM(@Title)), @Metric, @StartDate, @EndDate);
    DECLARE @id INT = SCOPE_IDENTITY();

    INSERT INTO dbo.ChallengeParticipants (ChallengeID, UserID) VALUES (@id, @CreatorID);

    IF @InviteeCsv IS NOT NULL AND LEN(@InviteeCsv) > 0
        INSERT INTO dbo.ChallengeParticipants (ChallengeID, UserID)
        SELECT DISTINCT @id, TRY_CONVERT(INT, LTRIM(RTRIM(value)))
        FROM STRING_SPLIT(@InviteeCsv, ',')
        WHERE TRY_CONVERT(INT, LTRIM(RTRIM(value))) IS NOT NULL
          AND TRY_CONVERT(INT, LTRIM(RTRIM(value))) <> @CreatorID
          AND EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserID = TRY_CONVERT(INT, LTRIM(RTRIM(value))));

    SELECT @id AS ChallengeID;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_JoinChallenge
    @ChallengeID INT, @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.ChallengeParticipants WHERE ChallengeID = @ChallengeID AND UserID = @UserID)
        INSERT INTO dbo.ChallengeParticipants (ChallengeID, UserID) VALUES (@ChallengeID, @UserID);
    SELECT 1 AS ok;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_LeaveChallenge
    @ChallengeID INT, @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.ChallengeParticipants WHERE ChallengeID = @ChallengeID AND UserID = @UserID;
    -- if the creator leaves and no one is left, remove the challenge
    IF NOT EXISTS (SELECT 1 FROM dbo.ChallengeParticipants WHERE ChallengeID = @ChallengeID)
        DELETE FROM dbo.Challenges WHERE ChallengeID = @ChallengeID;
    SELECT 1 AS ok;
END
GO

-- Challenges the user takes part in (+ their own), newest first, with a
-- computed status (upcoming / active / ended) and participant count.
CREATE OR ALTER PROCEDURE dbo.sp_GetChallengesForUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
    SELECT c.ChallengeID, c.CreatorID, cu.FullName AS CreatorName,
           c.Title, c.Metric, c.StartDate, c.EndDate, c.CreatedAt,
           (SELECT COUNT(*) FROM dbo.ChallengeParticipants p WHERE p.ChallengeID = c.ChallengeID) AS ParticipantCount,
           CASE WHEN @today < c.StartDate THEN 'upcoming'
                WHEN @today > c.EndDate  THEN 'ended'
                ELSE 'active' END AS Status
    FROM dbo.Challenges c
    JOIN dbo.Users cu ON cu.UserID = c.CreatorID
    WHERE EXISTS (SELECT 1 FROM dbo.ChallengeParticipants p
                  WHERE p.ChallengeID = c.ChallengeID AND p.UserID = @UserID)
    ORDER BY CASE WHEN @today BETWEEN c.StartDate AND c.EndDate THEN 0
                  WHEN @today < c.StartDate THEN 1 ELSE 2 END,
             c.EndDate DESC;
END
GO

-- Live standings for one challenge (confirmed logs inside the window only).
CREATE OR ALTER PROCEDURE dbo.sp_GetChallengeStandings
    @ChallengeID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @metric NVARCHAR(20), @start DATE, @end DATE;
    SELECT @metric = Metric, @start = StartDate, @end = EndDate
    FROM dbo.Challenges WHERE ChallengeID = @ChallengeID;

    SELECT p.UserID,
           u.FullName,
           u.ProfileImagePath,
           CAST(ISNULL(CASE @metric
                WHEN 'workouts' THEN COUNT(al.ActivityID)
                WHEN 'distance' THEN SUM(al.DistanceKM)
                ELSE SUM(al.CalculatedLoadForSession) END, 0) AS FLOAT) AS Score
    FROM dbo.ChallengeParticipants p
    JOIN dbo.Users u ON u.UserID = p.UserID
    LEFT JOIN dbo.ActivityLogs al
           ON al.UserID = p.UserID
          AND (al.IsConfirmed IS NULL OR al.IsConfirmed = 1)
          AND CAST(al.StartTime AS DATE) BETWEEN @start AND @end
    WHERE p.ChallengeID = @ChallengeID
    GROUP BY p.UserID, u.FullName, u.ProfileImagePath
    ORDER BY Score DESC;
END
GO

-- =====================================================================
-- #145  GROUP RUNS / EVENTS
-- =====================================================================
IF OBJECT_ID('dbo.Events', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Events (
        EventID      INT IDENTITY(1,1) PRIMARY KEY,
        CreatorID    INT NOT NULL REFERENCES dbo.Users(UserID),
        Title        NVARCHAR(120) NOT NULL,
        Description  NVARCHAR(600) NULL,
        EventTime    DATETIME2 NOT NULL,
        LocationName NVARCHAR(200) NULL,
        Latitude     FLOAT NULL,
        Longitude    FLOAT NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Events_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Events_Time ON dbo.Events(EventTime);
END
GO

IF OBJECT_ID('dbo.EventRSVPs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventRSVPs (
        EventID     INT NOT NULL REFERENCES dbo.Events(EventID) ON DELETE CASCADE,
        UserID      INT NOT NULL REFERENCES dbo.Users(UserID),
        Status      NVARCHAR(10) NOT NULL DEFAULT 'going',   -- going | maybe | no
        RespondedAt DATETIME2 NOT NULL CONSTRAINT DF_EventRSVPs_RespondedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_EventRSVPs PRIMARY KEY (EventID, UserID)
    );
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CreateEvent
    @CreatorID INT,
    @Title NVARCHAR(120),
    @Description NVARCHAR(600),
    @EventTime DATETIME2,
    @LocationName NVARCHAR(200),
    @Latitude FLOAT = NULL,
    @Longitude FLOAT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Events (CreatorID, Title, Description, EventTime, LocationName, Latitude, Longitude)
    VALUES (@CreatorID, LTRIM(RTRIM(@Title)), @Description, @EventTime, @LocationName, @Latitude, @Longitude);
    DECLARE @id INT = SCOPE_IDENTITY();
    INSERT INTO dbo.EventRSVPs (EventID, UserID, Status) VALUES (@id, @CreatorID, 'going');
    SELECT @id AS EventID;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RsvpEvent
    @EventID INT, @UserID INT, @Status NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    IF @Status NOT IN ('going','maybe','no') SET @Status = 'going';
    MERGE dbo.EventRSVPs AS tgt
    USING (SELECT @EventID AS EventID, @UserID AS UserID) AS src
       ON tgt.EventID = src.EventID AND tgt.UserID = src.UserID
    WHEN MATCHED THEN UPDATE SET Status = @Status, RespondedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (EventID, UserID, Status) VALUES (@EventID, @UserID, @Status);
    SELECT 1 AS ok;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_DeleteEvent
    @EventID INT, @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Events WHERE EventID = @EventID AND CreatorID = @UserID;
    SELECT @@ROWCOUNT AS deleted;
END
GO

-- Upcoming events created by the user or any of their accepted friends, with
-- the viewer's RSVP + a "going" count.
CREATE OR ALTER PROCEDURE dbo.sp_GetEventsForUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT e.EventID, e.CreatorID, cu.FullName AS CreatorName, cu.ProfileImagePath AS CreatorImage,
           e.Title, e.Description, e.EventTime, e.LocationName, e.Latitude, e.Longitude, e.CreatedAt,
           (SELECT COUNT(*) FROM dbo.EventRSVPs r WHERE r.EventID = e.EventID AND r.Status = 'going') AS GoingCount,
           (SELECT TOP 1 r2.Status FROM dbo.EventRSVPs r2 WHERE r2.EventID = e.EventID AND r2.UserID = @UserID) AS MyStatus
    FROM dbo.Events e
    JOIN dbo.Users cu ON cu.UserID = e.CreatorID
    WHERE e.EventTime >= DATEADD(HOUR, -12, SYSUTCDATETIME())
      AND (e.CreatorID = @UserID
           OR EXISTS (SELECT 1 FROM dbo.Friendships f
                      WHERE f.Status = 'accepted'
                        AND ((f.RequesterID = @UserID AND f.AddresseeID = e.CreatorID)
                          OR (f.AddresseeID = @UserID AND f.RequesterID = e.CreatorID))))
    ORDER BY e.EventTime ASC;
END
GO

-- Who RSVP'd to one event (going/maybe).
CREATE OR ALTER PROCEDURE dbo.sp_GetEventAttendees
    @EventID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.UserID, u.FullName, u.ProfileImagePath, r.Status
    FROM dbo.EventRSVPs r
    JOIN dbo.Users u ON u.UserID = r.UserID
    WHERE r.EventID = @EventID AND r.Status <> 'no'
    ORDER BY CASE r.Status WHEN 'going' THEN 0 ELSE 1 END, u.FullName;
END
GO

-- =====================================================================
-- #169  COACH MARKETPLACE + REVIEWS
-- =====================================================================
IF OBJECT_ID('dbo.CoachReviews', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachReviews (
        ReviewID       INT IDENTITY(1,1) PRIMARY KEY,
        CoachUserID    INT NOT NULL REFERENCES dbo.Users(UserID),
        ReviewerUserID INT NOT NULL REFERENCES dbo.Users(UserID),
        Rating         TINYINT NOT NULL,       -- 1..5
        [Text]         NVARCHAR(600) NULL,
        CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_CoachReviews_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CoachReviews UNIQUE (CoachUserID, ReviewerUserID)   -- one review per relationship
    );
END
GO

-- List coaches for discovery with avg rating + review count. Optional text
-- search on name; sortable by rating or name. Whitelisted @Sort (no SQL-injection).
CREATE OR ALTER PROCEDURE dbo.sp_GetCoachMarketplace
    @ViewerID INT,
    @Search NVARCHAR(120) = NULL,
    @Sort   NVARCHAR(20) = 'rating'   -- rating | name
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserID,
           u.FullName,
           u.ProfileImagePath,
           u.ExperienceLevel,
           CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
           CAST(ISNULL((SELECT AVG(CAST(cr.Rating AS FLOAT)) FROM dbo.CoachReviews cr WHERE cr.CoachUserID = u.UserID), 0) AS FLOAT) AS AvgRating,
           (SELECT COUNT(*) FROM dbo.CoachReviews cr WHERE cr.CoachUserID = u.UserID) AS ReviewCount,
           (SELECT COUNT(*) FROM dbo.CoachTrainees ct JOIN dbo.Coaches co ON co.CoachID = ct.CoachID WHERE co.UserID = u.UserID) AS TraineeCount,
           CAST(CASE WHEN EXISTS (
                SELECT 1 FROM dbo.CoachTrainees ct JOIN dbo.Coaches co ON co.CoachID = ct.CoachID
                WHERE co.UserID = u.UserID AND ct.UserID = @ViewerID) THEN 1 ELSE 0 END AS BIT) AS IsMyCoach
    FROM dbo.Users u
    WHERE u.IsCoach = 1 AND u.UserID <> @ViewerID
      AND (@Search IS NULL OR @Search = '' OR u.FullName LIKE '%' + @Search + '%')
    ORDER BY CASE WHEN @Sort = 'name' THEN u.FullName END ASC,
             CASE WHEN @Sort = 'name' THEN NULL ELSE
                  CAST(ISNULL((SELECT AVG(CAST(cr.Rating AS FLOAT)) FROM dbo.CoachReviews cr WHERE cr.CoachUserID = u.UserID), 0) AS FLOAT)
             END DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetCoachReviews
    @CoachUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cr.ReviewID, cr.CoachUserID, cr.ReviewerUserID,
           u.FullName AS ReviewerName, u.ProfileImagePath AS ReviewerImage,
           cr.Rating, cr.[Text], cr.CreatedAt
    FROM dbo.CoachReviews cr
    JOIN dbo.Users u ON u.UserID = cr.ReviewerUserID
    WHERE cr.CoachUserID = @CoachUserID
    ORDER BY cr.CreatedAt DESC;
END
GO

-- Upsert a review. Only a current/former trainee of the coach may review
-- (enforced here — @WasTrainee is passed by the BL after a CoachTrainees check).
CREATE OR ALTER PROCEDURE dbo.sp_UpsertCoachReview
    @CoachUserID INT, @ReviewerUserID INT, @Rating TINYINT, @Text NVARCHAR(600)
AS
BEGIN
    SET NOCOUNT ON;
    IF @Rating < 1 SET @Rating = 1;
    IF @Rating > 5 SET @Rating = 5;
    MERGE dbo.CoachReviews AS tgt
    USING (SELECT @CoachUserID AS C, @ReviewerUserID AS R) AS src
       ON tgt.CoachUserID = src.C AND tgt.ReviewerUserID = src.R
    WHEN MATCHED THEN UPDATE SET Rating = @Rating, [Text] = @Text, CreatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (CoachUserID, ReviewerUserID, Rating, [Text])
                          VALUES (@CoachUserID, @ReviewerUserID, @Rating, @Text);
    SELECT 1 AS ok;
END
GO

-- =====================================================================
-- #144  ACTIVITY FEED  (friends' recent workouts + board posts, merged)
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetActivityFeed
    @UserID INT,
    @Limit  INT = 40
AS
BEGIN
    SET NOCOUNT ON;
    IF @Limit < 1 SET @Limit = 1;
    IF @Limit > 100 SET @Limit = 100;

    -- accepted-friend ids
    DECLARE @friends TABLE (FriendID INT PRIMARY KEY);
    INSERT INTO @friends (FriendID)
    SELECT CASE WHEN f.RequesterID = @UserID THEN f.AddresseeID ELSE f.RequesterID END
    FROM dbo.Friendships f
    WHERE f.Status = 'accepted' AND (f.RequesterID = @UserID OR f.AddresseeID = @UserID);

    ;WITH feed AS (
        -- friends' confirmed workouts
        SELECT TOP (@Limit)
               'workout' AS FeedType,
               al.ActivityID AS RefID,
               al.UserID AS ActorID,
               u.FullName AS ActorName,
               u.ProfileImagePath AS ActorImage,
               at.TypeName AS Title,
               CAST(al.Duration AS NVARCHAR(20)) + ' min · load ' + CAST(al.CalculatedLoadForSession AS NVARCHAR(20)) AS Subtitle,
               CAST(NULL AS NVARCHAR(300)) AS ImagePath,
               al.StartTime AS CreatedAt
        FROM dbo.ActivityLogs al
        JOIN dbo.Users u ON u.UserID = al.UserID
        JOIN dbo.ActivityTypes at ON at.ActivityTypeID = al.ActivityTypeID
        WHERE al.UserID IN (SELECT FriendID FROM @friends)
          AND (al.IsConfirmed IS NULL OR al.IsConfirmed = 1)
        UNION ALL
        -- friends' board posts
        SELECT TOP (@Limit)
               'post' AS FeedType,
               p.PostId AS RefID,
               p.UserID AS ActorID,
               u.FullName AS ActorName,
               u.ProfileImagePath AS ActorImage,
               p.Title,
               p.Description AS Subtitle,
               p.ImagePath,
               p.CreatedAt
        FROM dbo.WorkoutPosts p
        JOIN dbo.Users u ON u.UserID = p.UserID
        WHERE p.UserID IN (SELECT FriendID FROM @friends)
          AND p.IsPublic = 1
    )
    SELECT TOP (@Limit) *
    FROM feed
    ORDER BY CreatedAt DESC;
END
GO
