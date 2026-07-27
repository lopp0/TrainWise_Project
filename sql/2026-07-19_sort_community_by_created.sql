/* ============================================================================
   2026-07-19 — device-test #6: sort Challenges and Events by CREATION DATE
   (newest first) instead of by end-date / event-time.

   Both procs ALREADY EXIST (created 2026-07-17, challenges re-defined by
   2026-07-19_fix_challenges.sql), so CREATE OR ALTER is correct here. Only use
   the DROP + CREATE dance for BRAND-NEW objects (see lessons.md 2026-07-19).

   Run AFTER: 2026-07-17_add_community_batch.sql and 2026-07-19_fix_challenges.sql.
   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

-- Challenges the user has JOINED, newest created first.
-- (Keeps the joined-only filter + participant count from 2026-07-19_fix_challenges.)
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
    ORDER BY c.CreatedAt DESC, c.ChallengeID DESC;
END
GO

-- Events from the user or their accepted friends, newest created first.
-- The "still upcoming" window filter is kept: past events should still drop off.
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
    ORDER BY e.CreatedAt DESC, e.EventID DESC;
END
GO
