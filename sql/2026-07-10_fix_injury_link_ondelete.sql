-- ============================================================================
-- Fix: deleting an ActivityLog failed with
--   "The DELETE statement conflicted with the REFERENCE constraint
--    FK_InjuriesReports_ActivityLogs ... column 'LinkedActivityLogID'"
-- whenever an injury report was linked to that workout (B-7 injury link).
--
-- Root cause: FK_InjuriesReports_ActivityLogs (added 2026-06-18) had NO
-- ON DELETE action, so SQL Server blocked the delete instead of clearing the
-- link. This also blocked the account-deletion cascade (sp_DeleteUser deletes
-- ActivityLogs BEFORE InjuriesReports).
--
-- Fix: recreate the FK with ON DELETE SET NULL so deleting a workout simply
-- unlinks any injury report that pointed at it (the injury report is KEPT, it
-- just loses its "appeared after this workout" link). Plus an explicit unlink
-- inside sp_DeleteActivityLog as a belt-and-suspenders safety net.
--
-- Idempotent: safe to run more than once, on BOTH the local SQL Express DB
-- (Lirone\SQLEXPRESS / TrainWise) and Azure SQL (trainwiseadmin / TrainWiseDB).
-- Depends on 2026-06-18_add_injury_link.sql (the column + FK).
-- NOTE: real table name is the historical typo "InjuriesReports"; the
-- ActivityLogs primary key is "ActivityID".
-- ============================================================================

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InjuriesReports')
      AND name = 'LinkedActivityLogID'
)
BEGIN
    -- Drop the old (blocking) FK if it exists...
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InjuriesReports_ActivityLogs')
        ALTER TABLE dbo.InjuriesReports DROP CONSTRAINT FK_InjuriesReports_ActivityLogs;

    -- ...and recreate it with ON DELETE SET NULL.
    ALTER TABLE dbo.InjuriesReports
        ADD CONSTRAINT FK_InjuriesReports_ActivityLogs
        FOREIGN KEY (LinkedActivityLogID) REFERENCES dbo.ActivityLogs(ActivityID)
        ON DELETE SET NULL;
END
GO

-- Safety net: unlink explicitly inside the delete SP too, so the delete still
-- succeeds even if the FK is ever recreated without ON DELETE SET NULL. Guarded
-- by COL_LENGTH so it's a no-op on a DB that never ran the injury-link migration.
CREATE OR ALTER PROCEDURE [dbo].[sp_DeleteActivityLog]
    @ActivityID INT
AS
BEGIN
    SET NOCOUNT ON;

    IF COL_LENGTH('dbo.InjuriesReports', 'LinkedActivityLogID') IS NOT NULL
        UPDATE dbo.InjuriesReports
           SET LinkedActivityLogID = NULL
         WHERE LinkedActivityLogID = @ActivityID;

    DELETE FROM ActivityLogs WHERE ActivityID = @ActivityID;
END
GO
