-- ============================================================================
-- B-7 : link an injury report to the workout after which it appeared.
-- Adds InjuriesReports.LinkedActivityLogID (nullable, FK -> ActivityLogs.ActivityID)
-- and teaches sp_InsertInjuryReport to store it.
--
-- Idempotent: safe to run more than once, on BOTH the local SQL Express DB
-- (Lirone\SQLEXPRESS / TrainWise) and Azure SQL (trainwiseadmin / TrainWiseDB).
-- NOTE the real table name is the (historical) typo "InjuriesReports" and the
-- ActivityLogs primary key is "ActivityID" (not ActivityLogID).
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InjuriesReports')
      AND name = 'LinkedActivityLogID'
)
BEGIN
    ALTER TABLE dbo.InjuriesReports ADD LinkedActivityLogID INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InjuriesReports_ActivityLogs'
)
BEGIN
    ALTER TABLE dbo.InjuriesReports
        ADD CONSTRAINT FK_InjuriesReports_ActivityLogs
        FOREIGN KEY (LinkedActivityLogID) REFERENCES dbo.ActivityLogs(ActivityID);
END
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_InsertInjuryReport]
    @UserID INT,
    @InjuryTypeID INT,
    @Date DATE,
    @Severity INT,
    @Notes NVARCHAR(MAX),
    @IsActiveInjury BIT = 1,
    @LinkedActivityLogID INT = NULL
AS
BEGIN
    INSERT INTO InjuriesReports
        (UserID, InjuryTypeID, Date, Severity, Notes, IsActiveInjury, LinkedActivityLogID)
    VALUES
        (@UserID, @InjuryTypeID, @Date, @Severity, @Notes, @IsActiveInjury, @LinkedActivityLogID);

    SELECT SCOPE_IDENTITY() AS NewInjuryID;
END
GO
