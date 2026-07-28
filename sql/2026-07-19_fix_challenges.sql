/* ============================================================================
   2026-07-19 — Friend challenges rework (device-test feedback #2):
     • invited users are now PENDING ('invited') and must accept — no auto-join
     • only TRAINEES can be invited (a coach-only user can't log workouts, so a
       challenge is pointless for them)
     • standings carry equipped cosmetics (badge / title / frame) + experience
     • sp_GetFriends now returns IsTrainee / IsCoach so the client can filter

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

-- Participant status: 'joined' (counts) | 'invited' (pending). Existing rows
-- default to 'joined' so current challenges are unaffected.
IF COL_LENGTH('dbo.ChallengeParticipants', 'Status') IS NULL
    ALTER TABLE dbo.ChallengeParticipants
        ADD Status NVARCHAR(10) NOT NULL CONSTRAINT DF_ChallengeParticipants_Status DEFAULT 'joined';
GO

-- Creator is auto-joined; invitees are added as 'invited' and ONLY if they are
-- trainees (IsTrainee = 1). They must accept before they count.
CREATE OR ALTER PROCEDURE dbo.sp_CreateChallenge
    @CreatorID INT,
    @Title     NVARCHAR(120),
    @Metric    NVARCHAR(20),
    @StartDate DATE,
    @EndDate   DATE,
    @InviteeCsv NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @Metric NOT IN ('load','workouts','distance') SET @Metric = 'load';
    INSERT INTO dbo.Challenges (CreatorID, Title, Metric, StartDate, EndDate)
    VALUES (@CreatorID, LTRIM(RTRIM(@Title)), @Metric, @StartDate, @EndDate);
    DECLARE @id INT = SCOPE_IDENTITY();

    INSERT INTO dbo.ChallengeParticipants (ChallengeID, UserID, Status) VALUES (@id, @CreatorID, 'joined');

    IF @InviteeCsv IS NOT NULL AND LEN(@InviteeCsv) > 0
        INSERT INTO dbo.ChallengeParticipants (ChallengeID, UserID, Status)
        SELECT DISTINCT @id, u.UserID, 'invited'
        FROM dbo.Users u
        WHERE u.IsTrainee = 1
          AND u.UserID <> @CreatorID
          AND u.UserID IN (
              SELECT TRY_CONVERT(INT, LTRIM(RTRIM(value)))
              FROM STRING_SPLIT(@InviteeCsv, ',')
              WHERE TRY_CONVERT(INT, LTRIM(RTRIM(value))) IS NOT NULL
          );

    SELECT @id AS ChallengeID;
END
GO

-- Joining directly (from an invite accept or a public join) marks 'joined'.
CREATE OR ALTER PROCEDURE dbo.sp_JoinChallenge
    @ChallengeID INT, @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.ChallengeParticipants AS tgt
    USING (SELECT @ChallengeID AS C, @UserID AS U) AS src
       ON tgt.ChallengeID = src.C AND tgt.UserID = src.U
    WHEN MATCHED THEN UPDATE SET Status = 'joined'
    WHEN NOT MATCHED THEN INSERT (ChallengeID, UserID, Status) VALUES (@ChallengeID, @UserID, 'joined');
    SELECT 1 AS ok;
END
GO

-- Challenges the user has JOINED (invites are surfaced separately). Counts +
-- standings only include joined participants.
CREATE OR ALTER PROCEDURE dbo.sp_GetChallengesForUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
    SELECT c.ChallengeID, c.CreatorID, cu.FullName AS CreatorName,
           c.Title, c.Metric, c.StartDate, c.EndDate, c.CreatedAt,
           (SELECT COUNT(*) FROM dbo.ChallengeParticipants p WHERE p.ChallengeID = c.ChallengeID AND p.Status = 'joined') AS ParticipantCount,
           CASE WHEN @today < c.StartDate THEN 'upcoming'
                WHEN @today > c.EndDate  THEN 'ended'
                ELSE 'active' END AS Status
    FROM dbo.Challenges c
    JOIN dbo.Users cu ON cu.UserID = c.CreatorID
    WHERE EXISTS (SELECT 1 FROM dbo.ChallengeParticipants p
                  WHERE p.ChallengeID = c.ChallengeID AND p.UserID = @UserID AND p.Status = 'joined')
    ORDER BY CASE WHEN @today BETWEEN c.StartDate AND c.EndDate THEN 0
                  WHEN @today < c.StartDate THEN 1 ELSE 2 END,
             c.EndDate DESC;
END
GO

-- Pending invitations for the user (challenges they've been invited to but not
-- yet accepted). NOTE: these two procs are NEW, so use DROP + CREATE rather than
-- CREATE OR ALTER (some servers resolve CREATE OR ALTER for a not-yet-existing
-- object as a plain ALTER → Msg 208 "invalid object name"). Idempotent.
IF OBJECT_ID('dbo.sp_GetChallengeInvites', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetChallengeInvites;
GO
CREATE PROCEDURE dbo.sp_GetChallengeInvites
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ChallengeID, c.CreatorID, cu.FullName AS CreatorName,
           c.Title, c.Metric, c.StartDate, c.EndDate, c.CreatedAt,
           (SELECT COUNT(*) FROM dbo.ChallengeParticipants p WHERE p.ChallengeID = c.ChallengeID AND p.Status = 'joined') AS ParticipantCount,
           'invited' AS Status
    FROM dbo.Challenges c
    JOIN dbo.Users cu ON cu.UserID = c.CreatorID
    JOIN dbo.ChallengeParticipants p ON p.ChallengeID = c.ChallengeID AND p.UserID = @UserID AND p.Status = 'invited'
    WHERE c.EndDate >= CAST(SYSDATETIME() AS DATE)
    ORDER BY c.CreatedAt DESC;
END
GO

-- Accept (-> joined) or decline (-> row removed) an invitation.
IF OBJECT_ID('dbo.sp_RespondChallengeInvite', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RespondChallengeInvite;
GO
CREATE PROCEDURE dbo.sp_RespondChallengeInvite
    @ChallengeID INT, @UserID INT, @Accept BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Accept = 1
        UPDATE dbo.ChallengeParticipants SET Status = 'joined'
        WHERE ChallengeID = @ChallengeID AND UserID = @UserID AND Status = 'invited';
    ELSE
        DELETE FROM dbo.ChallengeParticipants
        WHERE ChallengeID = @ChallengeID AND UserID = @UserID AND Status = 'invited';
    SELECT 1 AS ok;
END
GO

-- Standings: joined participants only, now carrying equipped cosmetics so the
-- client can render badges / frames / titles like the leaderboard.
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
           u.ExperienceLevel,
           u.EquippedBadge,
           u.EquippedTitle,
           u.EquippedFrame,
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
    WHERE p.ChallengeID = @ChallengeID AND p.Status = 'joined'
    GROUP BY p.UserID, u.FullName, u.ProfileImagePath, u.ExperienceLevel,
             u.EquippedBadge, u.EquippedTitle, u.EquippedFrame
    ORDER BY Score DESC;
END
GO

-- sp_GetFriends now returns IsTrainee / IsCoach so the challenge invite picker
-- can hide coach-only friends.
CREATE OR ALTER PROCEDURE dbo.sp_GetFriends
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        CASE WHEN f.RequesterID = @UserID THEN f.AddresseeID ELSE f.RequesterID END AS FriendUserID,
        u.FullName,
        u.Email,
        u.ProfileImagePath,
        u.ExperienceLevel,
        u.IsTrainee,
        u.IsCoach,
        u.LastSeen,
        CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
        f.FriendshipID
    FROM dbo.Friendships f
    JOIN dbo.Users u ON u.UserID = CASE WHEN f.RequesterID = @UserID THEN f.AddresseeID ELSE f.RequesterID END
    WHERE f.Status = 'accepted' AND (f.RequesterID = @UserID OR f.AddresseeID = @UserID)
    ORDER BY u.FullName;
END
GO
