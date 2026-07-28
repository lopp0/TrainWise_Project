/* ============================================================================
   2026-07-17 — Coach/records/account medium batch:
     #134 Coach comments on a workout   (WorkoutComments + procs)
     #165 Per-activity personal bests    (proc only — computed from ActivityLogs)
     #113 Delete my account (GDPR)        (harden sp_DeleteUser to cascade the
                                           newer child tables so the FK-guarded
                                           DELETE never fails)

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

-- =====================================================================
-- #134  COACH COMMENTS ON A WORKOUT
-- =====================================================================
IF OBJECT_ID('dbo.WorkoutComments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkoutComments (
        CommentId    INT IDENTITY(1,1) PRIMARY KEY,
        ActivityID   INT NOT NULL,
        AuthorUserID INT NOT NULL REFERENCES dbo.Users(UserID),
        [Text]       NVARCHAR(600) NOT NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_WorkoutComments_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_WorkoutComments_Log FOREIGN KEY (ActivityID)
            REFERENCES dbo.ActivityLogs(ActivityID) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkoutComments_Log ON dbo.WorkoutComments(ActivityID, CreatedAt);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetWorkoutComments
    @ActivityID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CommentId, c.ActivityID, c.AuthorUserID,
           u.FullName AS AuthorName, u.ProfileImagePath AS AuthorImage, u.IsCoach,
           c.[Text], c.CreatedAt
    FROM dbo.WorkoutComments c
    JOIN dbo.Users u ON u.UserID = c.AuthorUserID
    WHERE c.ActivityID = @ActivityID
    ORDER BY c.CreatedAt ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_AddWorkoutComment
    @ActivityID INT, @AuthorUserID INT, @Text NVARCHAR(600)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.WorkoutComments (ActivityID, AuthorUserID, [Text])
    VALUES (@ActivityID, @AuthorUserID, @Text);
    SELECT SCOPE_IDENTITY() AS CommentId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_DeleteWorkoutComment
    @CommentId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.WorkoutComments WHERE CommentId = @CommentId;
END
GO

-- =====================================================================
-- #165  PER-ACTIVITY PERSONAL BESTS  (best effort per activity type)
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetActivityBests
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT at.ActivityTypeID,
           at.TypeName,
           COUNT(*)                                   AS Sessions,
           CAST(MAX(al.DistanceKM) AS FLOAT)          AS MaxDistanceKm,
           MAX(al.Duration)                           AS MaxDurationMin,
           MAX(al.CalculatedLoadForSession)           AS MaxLoad,
           -- best pace (min/km) only over sessions with meaningful distance
           CAST(MIN(CASE WHEN al.DistanceKM >= 0.5 AND al.Duration > 0
                         THEN al.Duration * 1.0 / al.DistanceKM END) AS FLOAT) AS BestPaceMinPerKm,
           MAX(al.StartTime)                          AS LastDone
    FROM dbo.ActivityLogs al
    JOIN dbo.ActivityTypes at ON at.ActivityTypeID = al.ActivityTypeID
    WHERE al.UserID = @UserID
      AND (al.IsConfirmed IS NULL OR al.IsConfirmed = 1)
    GROUP BY at.ActivityTypeID, at.TypeName
    HAVING COUNT(*) > 0
    ORDER BY Sessions DESC;
END
GO

-- =====================================================================
-- #113  HARDENED sp_DeleteUser  (GDPR — remove ALL rows referencing the user)
-- =====================================================================
-- Every DELETE is guarded by OBJECT_ID so this proc is safe on databases that
-- don't have every optional table. Order matters only where FKs exist; the
-- transaction rolls back on any error.
CREATE OR ALTER PROCEDURE dbo.sp_DeleteUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- community batch (2026-07-17)
        IF OBJECT_ID('dbo.ChallengeParticipants','U') IS NOT NULL DELETE FROM dbo.ChallengeParticipants WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.Challenges','U') IS NOT NULL          DELETE FROM dbo.Challenges WHERE CreatorID = @UserID;
        IF OBJECT_ID('dbo.EventRSVPs','U') IS NOT NULL           DELETE FROM dbo.EventRSVPs WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.Events','U') IS NOT NULL               DELETE FROM dbo.Events WHERE CreatorID = @UserID;
        IF OBJECT_ID('dbo.CoachReviews','U') IS NOT NULL         DELETE FROM dbo.CoachReviews WHERE CoachUserID = @UserID OR ReviewerUserID = @UserID;
        IF OBJECT_ID('dbo.WorkoutComments','U') IS NOT NULL      DELETE FROM dbo.WorkoutComments WHERE AuthorUserID = @UserID;

        -- board / social
        IF OBJECT_ID('dbo.WorkoutPostComments','U') IS NOT NULL  DELETE FROM dbo.WorkoutPostComments WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.WorkoutPostLikes','U') IS NOT NULL     DELETE FROM dbo.WorkoutPostLikes WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.WorkoutKudos','U') IS NOT NULL         DELETE FROM dbo.WorkoutKudos WHERE FromUserID = @UserID;
        IF OBJECT_ID('dbo.WorkoutPosts','U') IS NOT NULL         DELETE FROM dbo.WorkoutPosts WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.Friendships','U') IS NOT NULL          DELETE FROM dbo.Friendships WHERE RequesterID = @UserID OR AddresseeID = @UserID;
        IF OBJECT_ID('dbo.CoachOffers','U') IS NOT NULL          DELETE FROM dbo.CoachOffers WHERE CoachUserID = @UserID OR TraineeUserID = @UserID;
        IF OBJECT_ID('dbo.GymCoaches','U') IS NOT NULL           DELETE FROM dbo.GymCoaches WHERE CoachUserID = @UserID;
        IF OBJECT_ID('dbo.LeaderboardOptIn','U') IS NOT NULL     DELETE FROM dbo.LeaderboardOptIn WHERE UserID = @UserID;

        -- chat
        IF OBJECT_ID('dbo.MessageReactions','U') IS NOT NULL     DELETE FROM dbo.MessageReactions WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.MessageTyping','U') IS NOT NULL        DELETE FROM dbo.MessageTyping WHERE FromUserID = @UserID OR ToUserID = @UserID;
        IF OBJECT_ID('dbo.Messages','U') IS NOT NULL             DELETE FROM dbo.Messages WHERE SenderID = @UserID OR ReceiverID = @UserID;

        -- calendar / records / health green-batch. (Cosmetics live as columns
        -- on dbo.Users, not a table. InjuryPainLog is intentionally NOT deleted
        -- here — its FK to InjuriesReports is ON DELETE CASCADE, so it is removed
        -- automatically when InjuriesReports rows are deleted below.)
        IF OBJECT_ID('dbo.PlannedWorkouts','U') IS NOT NULL      DELETE FROM dbo.PlannedWorkouts WHERE UserID = @UserID OR CreatedByCoach = @UserID;
        IF OBJECT_ID('dbo.PersonalRecords','U') IS NOT NULL      DELETE FROM dbo.PersonalRecords WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.EarnedBadges','U') IS NOT NULL         DELETE FROM dbo.EarnedBadges WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.BodyMeasurements','U') IS NOT NULL     DELETE FROM dbo.BodyMeasurements WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.NutritionLog','U') IS NOT NULL         DELETE FROM dbo.NutritionLog WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.WorkoutTemplates','U') IS NOT NULL     DELETE FROM dbo.WorkoutTemplates WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.MonthlyForecasts','U') IS NOT NULL     DELETE FROM dbo.MonthlyForecasts WHERE TraineeUserID = @UserID;

        -- core (original sp_DeleteUser set)
        IF OBJECT_ID('dbo.DailyLoad','U') IS NOT NULL               DELETE FROM dbo.DailyLoad WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.ActivityLogs','U') IS NOT NULL            DELETE FROM dbo.ActivityLogs WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.UserActivityPreferences','U') IS NOT NULL DELETE FROM dbo.UserActivityPreferences WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.UserTrainingGoals','U') IS NOT NULL       DELETE FROM dbo.UserTrainingGoals WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.UserDevices','U') IS NOT NULL             DELETE FROM dbo.UserDevices WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.InjuriesReports','U') IS NOT NULL         DELETE FROM dbo.InjuriesReports WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.Recommendations','U') IS NOT NULL         DELETE FROM dbo.Recommendations WHERE UserID = @UserID;
        IF OBJECT_ID('dbo.CoachRecommendations','U') IS NOT NULL    DELETE FROM dbo.CoachRecommendations WHERE UserID = @UserID OR CoachID = @UserID;
        -- remove links where the user is the trainee, AND where the user is the
        -- coach (resolve their CoachID) so the Coaches DELETE below can't FK-fail.
        IF OBJECT_ID('dbo.CoachTrainees','U') IS NOT NULL           DELETE FROM dbo.CoachTrainees WHERE UserID = @UserID OR CoachID IN (SELECT CoachID FROM dbo.Coaches WHERE UserID = @UserID);
        IF OBJECT_ID('dbo.Coaches','U') IS NOT NULL                 DELETE FROM dbo.Coaches WHERE UserID = @UserID;

        DELETE FROM dbo.Users WHERE UserID = @UserID;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
