/* ============================================================================
   2026-07-09 — Forgot-password (email code) support. Idempotent; safe to re-run.
   Run on BOTH local SQL Express (TrainWise) and Azure SQL (TrainWiseDB).
   ============================================================================ */

/* ---- PasswordResetCodes table --------------------------------------------- */
IF OBJECT_ID('dbo.PasswordResetCodes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetCodes (
        ResetID   INT IDENTITY(1,1) PRIMARY KEY,
        UserID    INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserID),
        CodeHash  NVARCHAR(64) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        Attempts  INT NOT NULL DEFAULT 0,
        Used      BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_PasswordResetCodes_UserID ON dbo.PasswordResetCodes(UserID);
END
GO

/* ---- sp_GetUserIDByEmail: minimal lookup, no plaintext info leaked out ---- */
CREATE OR ALTER PROCEDURE dbo.sp_GetUserIDByEmail
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID FROM dbo.Users WHERE Email = @Email;
END
GO

/* ---- sp_InvalidatePasswordResetCodes: burn any outstanding codes ---------- */
CREATE OR ALTER PROCEDURE dbo.sp_InvalidatePasswordResetCodes
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.PasswordResetCodes
    SET Used = 1
    WHERE UserID = @UserID AND Used = 0;
END
GO

/* ---- sp_InsertPasswordResetCode -------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_InsertPasswordResetCode
    @UserID    INT,
    @CodeHash  NVARCHAR(64),
    @ExpiresAt DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.PasswordResetCodes (UserID, CodeHash, ExpiresAt, Attempts, Used, CreatedAt)
    VALUES (@UserID, @CodeHash, @ExpiresAt, 0, 0, GETDATE());
    SELECT SCOPE_IDENTITY() AS ResetID;
END
GO

/* ---- sp_GetLatestPasswordResetCode: newest unused code for the user ------- */
CREATE OR ALTER PROCEDURE dbo.sp_GetLatestPasswordResetCode
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 ResetID, UserID, CodeHash, ExpiresAt, Attempts, Used, CreatedAt
    FROM dbo.PasswordResetCodes
    WHERE UserID = @UserID AND Used = 0
    ORDER BY CreatedAt DESC;
END
GO

/* ---- sp_IncrementResetCodeAttempts ----------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_IncrementResetCodeAttempts
    @ResetID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.PasswordResetCodes
    SET Attempts = Attempts + 1
    WHERE ResetID = @ResetID;
END
GO

/* ---- sp_MarkResetCodeUsed --------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_MarkResetCodeUsed
    @ResetID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.PasswordResetCodes
    SET Used = 1
    WHERE ResetID = @ResetID;
END
GO

/* ---- sp_UpdateUserPassword --------------------------------------------------
   Plaintext, matching current sp_LoginUser / sp_InsertUser behavior. The
   Password column is already NVARCHAR(200) from the 2026-07-02 migration.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserPassword
    @UserID   INT,
    @Password NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
    SET Password = @Password
    WHERE UserID = @UserID;
END
GO
