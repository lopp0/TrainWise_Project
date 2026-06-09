-- =====================================================================
-- TrainWise migration: add IsTrainee column to Users + update sp_InsertUser
-- Date: 2026-06-02
-- Run on the Azure SQL database the API connects to.
-- =====================================================================

-- 1) Add IsTrainee column. Default 1 keeps every existing user as a
--    trainee so nobody loses Home/Health/Add-workout access.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = 'IsTrainee'
)
BEGIN
    ALTER TABLE dbo.Users
        ADD IsTrainee BIT NOT NULL CONSTRAINT DF_Users_IsTrainee DEFAULT (1);
END
GO

-- 2) Replace sp_InsertUser with the same body + @IsTrainee param.
--    Matches your existing proc exactly (CHAR(8) password, GETDATE(),
--    IsBaselineEstablished=0 hardcoded, no baseline columns).
ALTER PROCEDURE [dbo].[sp_InsertUser]
    @FullName NVARCHAR(100),
    @BirthYear INT,
    @Gender NVARCHAR(20),
    @Height INT,
    @Weight INT,
    @ActivityLevel INT,
    @DeviceType NVARCHAR(100),
    @UserName NVARCHAR(50),
    @Email NVARCHAR(255),
    @Password CHAR(8),
    @ExperienceLevel TINYINT,
    @HealthDeclaration BIT,
    @ConfirmTerms BIT,
    @TermConfirmationDate DATE,
    @IsCoach BIT,
    @IsTrainee BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Users (FullName, BirthYear, Gender, Height, Weight,
        ActivityLevel, DeviceType, UserName, Email, Password,
        ExperienceLevel, HealthDeclaration, ConfirmTerms,
        TermConfirmationDate, IsBaselineEstablished, IsCoach, IsTrainee, CreatedAt)
    VALUES (@FullName, @BirthYear, @Gender, @Height, @Weight,
        @ActivityLevel, @DeviceType, @UserName, @Email, @Password,
        @ExperienceLevel, @HealthDeclaration, @ConfirmTerms,
        @TermConfirmationDate, 0, @IsCoach, @IsTrainee, GETDATE());
    SELECT SCOPE_IDENTITY() AS UserID;
END
GO

-- 3) sp_LoginUser / sp_GetUserByID / sp_GetAllUsers:
--    UserDAL.MapUser uses SafeReadBool with fallback=true, so missing the
--    column in the SELECT won't crash — but coach-only gating requires
--    the procs to actually return IsTrainee. If they use `SELECT *`, no
--    change needed. If they use an explicit column list, add IsTrainee.
