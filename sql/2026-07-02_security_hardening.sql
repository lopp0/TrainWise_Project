/* ============================================================================
   2026-07-02 — Security hardening (idempotent; safe to re-run).
   Run on BOTH local SQL Express (TrainWise) and Azure SQL (TrainWiseDB)
   BEFORE deploying the password-hashing backend change.

   WHY THIS IS REQUIRED FIRST:
     Users.Password was CHAR(8) — it can only hold an 8-char PLAINTEXT password.
     The backend now stores a salted PBKDF2 hash (~90 chars). If the column /
     sp_InsertUser stay at CHAR(8), every new sign-up truncates the hash to 8
     chars and all subsequent logins for that account fail. Widen them first.

   Backward compatible: existing plaintext rows still fit; the backend's
   PasswordHasher verifies legacy plaintext and re-hashes it on next login.
   ============================================================================ */

/* ---- Widen the password column to hold a PBKDF2 hash --------------------- */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Password'
      AND (system_type_id IN (175 /*char*/, 239 /*nchar*/) OR max_length < 400)
)
BEGIN
    ALTER TABLE dbo.Users ALTER COLUMN Password NVARCHAR(200) NULL;
END
GO

/* ---- sp_InsertUser: accept the full hash (was @Password CHAR(8)) --------- */
IF OBJECT_ID('dbo.sp_InsertUser', 'P') IS NOT NULL
BEGIN
    EXEC('
    ALTER PROCEDURE dbo.sp_InsertUser
        @FullName NVARCHAR(100),
        @BirthYear INT,
        @Gender NVARCHAR(20),
        @Height INT,
        @Weight INT,
        @ActivityLevel INT,
        @DeviceType NVARCHAR(100),
        @UserName NVARCHAR(50),
        @Email NVARCHAR(255),
        @Password NVARCHAR(200),
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
    END');
END
GO

/* ---- Optional cleanup: sp_LoginUser is no longer used by the backend ------
   Login now fetches the row by email and verifies the hash in C#. The old
   proc did a plaintext `WHERE Email=@Email AND Password=@Password` compare.
   It is left in place (harmless) but SHOULD NOT be relied on. If you want to
   guarantee it can't be used for a plaintext compare, drop it:
     -- IF OBJECT_ID('dbo.sp_LoginUser','P') IS NOT NULL DROP PROCEDURE dbo.sp_LoginUser;
   --------------------------------------------------------------------------- */
