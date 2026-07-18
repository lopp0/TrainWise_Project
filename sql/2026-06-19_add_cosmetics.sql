-- ============================================================================
-- A-1 : equipped cosmetics (badge / title / avatar-frame) persisted server-side
-- so other users see them in Connect. Stores the client SHOP_ITEMS string ids
-- (e.g. 'badge_crown', 'frame_gold', 'title_champion'); the visuals stay in
-- the client catalog (shopManager.js).
-- Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
--
-- sp_GetUserByID / sp_GetAllUsers use SELECT *, so the new columns flow through
-- automatically. sp_LoginUser uses an explicit column list, so it is re-created
-- below to include them.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EquippedBadge')
    ALTER TABLE dbo.Users ADD EquippedBadge NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EquippedTitle')
    ALTER TABLE dbo.Users ADD EquippedTitle NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EquippedFrame')
    ALTER TABLE dbo.Users ADD EquippedFrame NVARCHAR(50) NULL;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_LoginUser]
    @Email    NVARCHAR(255),
    @Password CHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, FullName, BirthYear, Gender, Height, Weight,
           ActivityLevel, CreatedAt, DeviceType, ProfileImagePath,
           UserName, Email, ExperienceLevel, BaseLineDailyLoad,
           BaseLineWeeklyLoad, IsBaselineEstablished, BaselineEstablishedDate,
           HealthDeclaration, ConfirmTerms, TermConfirmationDate, IsCoach, IsTrainee,
           EquippedBadge, EquippedTitle, EquippedFrame
    FROM Users
    WHERE Email = @Email
        AND Password = @Password COLLATE Latin1_General_CS_AS;
END
GO

-- Set the equipped cosmetics for a user (any of the three may be NULL).
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateEquippedItems]
    @UserID        INT,
    @EquippedBadge NVARCHAR(50) = NULL,
    @EquippedTitle NVARCHAR(50) = NULL,
    @EquippedFrame NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
       SET EquippedBadge = @EquippedBadge,
           EquippedTitle = @EquippedTitle,
           EquippedFrame = @EquippedFrame
     WHERE UserID = @UserID;
END
GO
