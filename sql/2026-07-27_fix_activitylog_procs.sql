/* ============================================================================
   2026-07-27 - ActivityLog stored-proc alignment (Yuval's post-push DB fixes).

   After the last backend publish, two stored procedures on some databases still
   carried OLD signatures that no longer matched the C# DAL, causing runtime
   errors:

     1) sp_UpdateActivityLog      - was missing @ActivityTypeID / @SourceDevice /
                                    @IsConfirmed. The DAL (ActivityLogDAL.Update)
                                    passes all 13 parameters.
     2) sp_GetActivityLogsForLoad - an old version took only @Date; the C#
                                    load path (DailyLoadDAL) passes
                                    @UserID / @StartDate / @EndDate.

   The two CREATE OR ALTER statements below bring both procedures to the
   canonical definition already present in TWDB.sql. Both procs already exist,
   so CREATE OR ALTER is safe (no "Msg 208" brand-new-object issue). Idempotent
   and safe to re-run.

   RUN ON BOTH: local SQL Express (database TrainWise) AND Azure SQL (TrainWiseDB).
   ============================================================================ */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---- 1) sp_UpdateActivityLog : full 13-parameter signature ---------------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateActivityLog]
    @ActivityID               INT,
    @ActivityTypeID           INT,
    @StartTime                DATETIME,
    @EndTime                  DATETIME,
    @DistanceKM               FLOAT,
    @AvgHeartRate             INT = NULL,
    @MaxHeartRate             INT = NULL,
    @CaloriesBurned           FLOAT = NULL,
    @SourceDevice             NVARCHAR(100),
    @ExertionLevel            TINYINT,
    @Duration                 SMALLINT,
    @CalculatedLoadForSession SMALLINT,
    @IsConfirmed              BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ActivityLogs SET
        ActivityTypeID           = @ActivityTypeID,
        StartTime                = @StartTime,
        EndTime                  = @EndTime,
        DistanceKM               = @DistanceKM,
        AvgHeartRate             = @AvgHeartRate,
        MaxHeartRate             = @MaxHeartRate,
        CaloriesBurned           = @CaloriesBurned,
        SourceDevice             = @SourceDevice,
        ExertionLevel            = @ExertionLevel,
        Duration                 = @Duration,
        CalculatedLoadForSession = @CalculatedLoadForSession,
        IsConfirmed              = @IsConfirmed
    WHERE ActivityID = @ActivityID;
END
GO

/* ---- 2) sp_GetActivityLogsForLoad : @UserID / @StartDate / @EndDate -------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_GetActivityLogsForLoad]
    @UserID    INT,
    @StartDate DATETIME,
    @EndDate   DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    SELECT * FROM ActivityLogs
    WHERE UserID = @UserID
      AND StartTime >= @StartDate
      AND StartTime <= @EndDate
    ORDER BY StartTime DESC;
END
GO
