/* ============================================================================
   2026-07-17 — Auth medium batch:
     #110 Forgot / reset password
     #114 Email verification

   One AuthCodes table serves both flows (Purpose = 'reset' | 'verify'). Codes are
   stored HASHED (PBKDF2, same PasswordHasher as passwords) — never in plaintext —
   single-use, short TTL. The C# side verifies the candidate against the stored
   hash (constant-time) so the DB never sees the raw code.

   Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
   ============================================================================ */

-- EmailVerified flag on Users (#114)
IF COL_LENGTH('dbo.Users', 'EmailVerified') IS NULL
    ALTER TABLE dbo.Users ADD EmailVerified BIT NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT 0;
GO

IF OBJECT_ID('dbo.AuthCodes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuthCodes (
        AuthCodeId INT IDENTITY(1,1) PRIMARY KEY,
        UserID     INT NOT NULL REFERENCES dbo.Users(UserID),
        Purpose    NVARCHAR(10) NOT NULL,          -- reset | verify
        CodeHash   NVARCHAR(200) NOT NULL,         -- PBKDF2 hash of the code
        ExpiresAt  DATETIME2 NOT NULL,
        Used       BIT NOT NULL CONSTRAINT DF_AuthCodes_Used DEFAULT 0,
        CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_AuthCodes_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_AuthCodes_Lookup ON dbo.AuthCodes(UserID, Purpose, Used);
END
GO

-- Create a fresh code, invalidating any previous unused codes of the same purpose
-- (single active code at a time).
CREATE OR ALTER PROCEDURE dbo.sp_CreateAuthCode
    @UserID INT, @Purpose NVARCHAR(10), @CodeHash NVARCHAR(200), @Minutes INT = 15
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.AuthCodes SET Used = 1 WHERE UserID = @UserID AND Purpose = @Purpose AND Used = 0;
    INSERT INTO dbo.AuthCodes (UserID, Purpose, CodeHash, ExpiresAt)
    VALUES (@UserID, @Purpose, @CodeHash, DATEADD(MINUTE, @Minutes, SYSUTCDATETIME()));
    SELECT SCOPE_IDENTITY() AS AuthCodeId;
END
GO

-- The current active (unused, unexpired) code row for a user+purpose.
CREATE OR ALTER PROCEDURE dbo.sp_GetActiveAuthCode
    @UserID INT, @Purpose NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 AuthCodeId, CodeHash, ExpiresAt
    FROM dbo.AuthCodes
    WHERE UserID = @UserID AND Purpose = @Purpose AND Used = 0 AND ExpiresAt > SYSUTCDATETIME()
    ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_MarkAuthCodeUsed
    @AuthCodeId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.AuthCodes SET Used = 1 WHERE AuthCodeId = @AuthCodeId;
END
GO

-- Resolve a user id from an email (0 = not found). Used by the forgot flow to
-- avoid leaking existence (the controller returns the same message regardless).
CREATE OR ALTER PROCEDURE dbo.sp_GetUserIdByEmail
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 UserID FROM dbo.Users WHERE Email = @Email;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SetEmailVerified
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET EmailVerified = 1 WHERE UserID = @UserID;
END
GO
