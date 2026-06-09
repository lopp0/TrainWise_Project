-- =====================================================================
-- TrainWise migration: social layer — friends, presence, gyms, coach offers
-- Feature #3 (Connect tab). Date: 2026-06-08
--
-- Run AFTER the schema + earlier migrations + seed_reference_data.sql
-- (the fake activity logs reference ActivityTypeIDs 1..6).
-- Idempotent: tables guarded by IF NOT EXISTS, columns by COL_LENGTH,
-- procs use CREATE OR ALTER, seed rows guarded by IF NOT EXISTS on Email.
--
-- Adds:
--   * Users.LastSeen / Latitude / Longitude  (heartbeat presence + map)
--   * Friendships              (friend requests / accept / list / remove)
--   * Gyms + GymCoaches        (map pins + coach recommendations)
--   * CoachOffers              (coach -> trainee "need a coach?" offers)
--   * stored procedures for all of the above
--   * seed: fake trainees, coaches, gyms near Netanya for the demo
-- Presence rule: a user is "online" if LastSeen is within the last 5 min.
-- =====================================================================

-- 0) Users: presence + location columns ---------------------------------
IF COL_LENGTH('dbo.Users', 'LastSeen') IS NULL
    ALTER TABLE dbo.Users ADD LastSeen DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users', 'Latitude') IS NULL
    ALTER TABLE dbo.Users ADD Latitude FLOAT NULL;
GO
IF COL_LENGTH('dbo.Users', 'Longitude') IS NULL
    ALTER TABLE dbo.Users ADD Longitude FLOAT NULL;
GO

-- 1) Friendships table --------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Friendships' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Friendships (
        FriendshipID INT IDENTITY(1,1) NOT NULL,
        RequesterID  INT NOT NULL,   -- who sent the request
        AddresseeID  INT NOT NULL,   -- who received it
        Status       NVARCHAR(20) NOT NULL CONSTRAINT DF_Friendships_Status DEFAULT ('pending'), -- pending|accepted|declined
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Friendships_CreatedAt DEFAULT (SYSUTCDATETIME()),
        RespondedAt  DATETIME2 NULL,
        CONSTRAINT PK_Friendships PRIMARY KEY CLUSTERED (FriendshipID ASC),
        CONSTRAINT FK_Friendships_Requester FOREIGN KEY (RequesterID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Friendships_Addressee FOREIGN KEY (AddresseeID) REFERENCES dbo.Users(UserID)
    );
    CREATE INDEX IX_Friendships_Requester ON dbo.Friendships (RequesterID, Status);
    CREATE INDEX IX_Friendships_Addressee ON dbo.Friendships (AddresseeID, Status);
END
GO

-- 2) Gyms + GymCoaches --------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Gyms' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Gyms (
        GymID       INT IDENTITY(1,1) NOT NULL,
        Name        NVARCHAR(150) NOT NULL,
        Address     NVARCHAR(250) NULL,
        City        NVARCHAR(80) NULL,
        Latitude    FLOAT NOT NULL,
        Longitude   FLOAT NOT NULL,
        Description NVARCHAR(500) NULL,
        Rating      DECIMAL(2,1) NULL,
        Phone       NVARCHAR(40) NULL,
        PhotoPath   NVARCHAR(300) NULL,
        CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_Gyms_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Gyms PRIMARY KEY CLUSTERED (GymID ASC)
    );
END
GO
-- City column for the Connect "filter by city" feature (existing DBs).
IF COL_LENGTH('dbo.Gyms', 'City') IS NULL
    ALTER TABLE dbo.Gyms ADD City NVARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GymCoaches' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.GymCoaches (
        GymCoachID  INT IDENTITY(1,1) NOT NULL,
        GymID       INT NOT NULL,
        CoachUserID INT NOT NULL,   -- the coach's Users.UserID
        CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_GymCoaches_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_GymCoaches PRIMARY KEY CLUSTERED (GymCoachID ASC),
        CONSTRAINT UQ_GymCoaches UNIQUE (GymID, CoachUserID),
        CONSTRAINT FK_GymCoaches_Gym  FOREIGN KEY (GymID)       REFERENCES dbo.Gyms(GymID),
        CONSTRAINT FK_GymCoaches_User FOREIGN KEY (CoachUserID) REFERENCES dbo.Users(UserID)
    );
END
GO

-- 3) CoachOffers (coach -> trainee "need a coach?") ---------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CoachOffers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CoachOffers (
        OfferID       INT IDENTITY(1,1) NOT NULL,
        CoachUserID   INT NOT NULL,   -- coach's Users.UserID
        TraineeUserID INT NOT NULL,   -- trainee's Users.UserID
        Status        NVARCHAR(20) NOT NULL CONSTRAINT DF_CoachOffers_Status DEFAULT ('pending'),
        CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_CoachOffers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        RespondedAt   DATETIME2 NULL,
        CONSTRAINT PK_CoachOffers PRIMARY KEY CLUSTERED (OfferID ASC),
        CONSTRAINT UQ_CoachOffers UNIQUE (CoachUserID, TraineeUserID),
        CONSTRAINT FK_CoachOffers_Coach   FOREIGN KEY (CoachUserID)   REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_CoachOffers_Trainee FOREIGN KEY (TraineeUserID) REFERENCES dbo.Users(UserID)
    );
END
GO

-- =====================================================================
-- PRESENCE + LOCATION procs
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateLastSeen
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET LastSeen = SYSUTCDATETIME() WHERE UserID = @UserID;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserLocation
    @UserID    INT,
    @Latitude  FLOAT,
    @Longitude FLOAT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
       SET Latitude = @Latitude, Longitude = @Longitude, LastSeen = SYSUTCDATETIME()
     WHERE UserID = @UserID;
END
GO

-- =====================================================================
-- NEARBY USERS + MINI PROFILE
-- =====================================================================
-- Users within @RadiusKm of the caller's coordinates (excludes self).
-- IsOnline = LastSeen within 5 minutes.
CREATE OR ALTER PROCEDURE dbo.sp_GetNearbyUsers
    @UserID    INT,
    @Latitude  FLOAT,
    @Longitude FLOAT,
    @RadiusKm  FLOAT = 25
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @origin geography = geography::Point(@Latitude, @Longitude, 4326);

    SELECT u.UserID,
           u.FullName,
           u.ProfileImagePath,
           u.ExperienceLevel,
           u.IsCoach,
           u.IsTrainee,
           u.Latitude,
           u.Longitude,
           u.LastSeen,
           CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
           @origin.STDistance(geography::Point(u.Latitude, u.Longitude, 4326)) / 1000.0 AS DistanceKm
    FROM dbo.Users u
    WHERE u.UserID <> @UserID
      AND u.Latitude IS NOT NULL
      AND u.Longitude IS NOT NULL
      AND @origin.STDistance(geography::Point(u.Latitude, u.Longitude, 4326)) <= @RadiusKm * 1000.0
    ORDER BY DistanceKm ASC;
END
GO

-- Quick-look profile when a pin is tapped: identity + training level +
-- top-3 activity types + the friendship status with the viewer.
CREATE OR ALTER PROCEDURE dbo.sp_GetUserMiniProfile
    @ViewerID INT,
    @TargetID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserID,
           u.FullName,
           u.ProfileImagePath,
           u.ExperienceLevel,
           u.IsCoach,
           u.IsTrainee,
           u.LastSeen,
           CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
           (SELECT STRING_AGG(t.TypeName, ', ') FROM (
                SELECT TOP 3 at.TypeName, COUNT(*) AS Cnt
                FROM dbo.ActivityLogs al
                JOIN dbo.ActivityTypes at ON al.ActivityTypeID = at.ActivityTypeID
                WHERE al.UserID = @TargetID
                GROUP BY at.TypeName
                ORDER BY COUNT(*) DESC
           ) t) AS TopActivities,
           (SELECT TOP 1 f.Status FROM dbo.Friendships f
             WHERE (f.RequesterID = @ViewerID AND f.AddresseeID = @TargetID)
                OR (f.RequesterID = @TargetID AND f.AddresseeID = @ViewerID)) AS FriendStatus,
           (SELECT TOP 1 f.RequesterID FROM dbo.Friendships f
             WHERE (f.RequesterID = @ViewerID AND f.AddresseeID = @TargetID)
                OR (f.RequesterID = @TargetID AND f.AddresseeID = @ViewerID)) AS FriendRequesterID,
           (SELECT TOP 1 f.FriendshipID FROM dbo.Friendships f
             WHERE (f.RequesterID = @ViewerID AND f.AddresseeID = @TargetID)
                OR (f.RequesterID = @TargetID AND f.AddresseeID = @ViewerID)) AS FriendshipID
    FROM dbo.Users u
    WHERE u.UserID = @TargetID;
END
GO

-- =====================================================================
-- FRIENDSHIP procs
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_SendFriendRequest
    @RequesterID INT,
    @AddresseeID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id INT, @status NVARCHAR(20);
    SELECT TOP 1 @id = FriendshipID, @status = Status
    FROM dbo.Friendships
    WHERE (RequesterID = @RequesterID AND AddresseeID = @AddresseeID)
       OR (RequesterID = @AddresseeID AND AddresseeID = @RequesterID);

    IF @id IS NULL
    BEGIN
        INSERT INTO dbo.Friendships (RequesterID, AddresseeID, Status, CreatedAt)
        VALUES (@RequesterID, @AddresseeID, 'pending', SYSUTCDATETIME());
        SET @id = SCOPE_IDENTITY();
    END
    ELSE IF @status = 'declined'
    BEGIN
        -- A previously declined pair can request again (fresh direction).
        UPDATE dbo.Friendships
           SET RequesterID = @RequesterID, AddresseeID = @AddresseeID,
               Status = 'pending', CreatedAt = SYSUTCDATETIME(), RespondedAt = NULL
         WHERE FriendshipID = @id;
    END

    SELECT FriendshipID, RequesterID, AddresseeID, Status, CreatedAt, RespondedAt
    FROM dbo.Friendships WHERE FriendshipID = @id;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RespondFriendRequest
    @FriendshipID INT,
    @Accept       BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Friendships
       SET Status = CASE WHEN @Accept = 1 THEN 'accepted' ELSE 'declined' END,
           RespondedAt = SYSUTCDATETIME()
     WHERE FriendshipID = @FriendshipID;

    SELECT FriendshipID, RequesterID, AddresseeID, Status, CreatedAt, RespondedAt
    FROM dbo.Friendships WHERE FriendshipID = @FriendshipID;
END
GO

-- Accepted friends of @UserID (the OTHER party + presence).
CREATE OR ALTER PROCEDURE dbo.sp_GetFriends
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        CASE WHEN f.RequesterID = @UserID THEN f.AddresseeID ELSE f.RequesterID END AS FriendUserID,
        u.FullName,
        u.Email,
        u.ProfileImagePath,
        u.ExperienceLevel,
        u.LastSeen,
        CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
        f.FriendshipID
    FROM dbo.Friendships f
    JOIN dbo.Users u ON u.UserID = CASE WHEN f.RequesterID = @UserID THEN f.AddresseeID ELSE f.RequesterID END
    WHERE f.Status = 'accepted' AND (f.RequesterID = @UserID OR f.AddresseeID = @UserID)
    ORDER BY u.FullName;
END
GO

-- Incoming pending requests addressed TO @UserID.
CREATE OR ALTER PROCEDURE dbo.sp_GetPendingFriendRequests
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT f.FriendshipID,
           f.RequesterID AS FriendUserID,
           u.FullName,
           u.Email,
           u.ProfileImagePath,
           u.ExperienceLevel,
           u.LastSeen,
           CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline,
           f.CreatedAt
    FROM dbo.Friendships f
    JOIN dbo.Users u ON u.UserID = f.RequesterID
    WHERE f.AddresseeID = @UserID AND f.Status = 'pending'
    ORDER BY f.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RemoveFriend
    @UserA INT,
    @UserB INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Friendships
    WHERE (RequesterID = @UserA AND AddresseeID = @UserB)
       OR (RequesterID = @UserB AND AddresseeID = @UserA);
END
GO

-- =====================================================================
-- GYM procs
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetGyms
    @Latitude  FLOAT,
    @Longitude FLOAT,
    @RadiusKm  FLOAT = 25
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @origin geography = geography::Point(@Latitude, @Longitude, 4326);
    SELECT g.GymID,
           g.Name,
           g.Address,
           g.City,
           g.Latitude,
           g.Longitude,
           g.Description,
           g.Rating,
           g.Phone,
           g.PhotoPath,
           @origin.STDistance(geography::Point(g.Latitude, g.Longitude, 4326)) / 1000.0 AS DistanceKm,
           (SELECT COUNT(*) FROM dbo.GymCoaches gc WHERE gc.GymID = g.GymID) AS CoachCount
    FROM dbo.Gyms g
    WHERE @origin.STDistance(geography::Point(g.Latitude, g.Longitude, 4326)) <= @RadiusKm * 1000.0
    ORDER BY DistanceKm ASC;
END
GO

-- Recommended coaches for a gym (their Users row + presence).
CREATE OR ALTER PROCEDURE dbo.sp_GetGymCoaches
    @GymID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserID,
           u.FullName,
           u.Email,
           u.ProfileImagePath,
           u.ExperienceLevel,
           u.LastSeen,
           CAST(CASE WHEN u.LastSeen >= DATEADD(MINUTE, -5, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS BIT) AS IsOnline
    FROM dbo.GymCoaches gc
    JOIN dbo.Users u ON u.UserID = gc.CoachUserID
    WHERE gc.GymID = @GymID
    ORDER BY u.FullName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_AddCoachToGym
    @GymID INT,
    @CoachUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.GymCoaches WHERE GymID = @GymID AND CoachUserID = @CoachUserID)
        INSERT INTO dbo.GymCoaches (GymID, CoachUserID) VALUES (@GymID, @CoachUserID);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RemoveCoachFromGym
    @GymID INT,
    @CoachUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.GymCoaches WHERE GymID = @GymID AND CoachUserID = @CoachUserID;
END
GO

-- Gyms a coach is listed at (to show "you're recommended here").
CREATE OR ALTER PROCEDURE dbo.sp_GetGymsForCoach
    @CoachUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT g.GymID, g.Name, g.Address, g.Latitude, g.Longitude
    FROM dbo.GymCoaches gc
    JOIN dbo.Gyms g ON g.GymID = gc.GymID
    WHERE gc.CoachUserID = @CoachUserID;
END
GO

-- =====================================================================
-- COACH OFFER procs (coach -> trainee)
-- =====================================================================
CREATE OR ALTER PROCEDURE dbo.sp_SendCoachOffer
    @CoachUserID   INT,
    @TraineeUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id INT, @status NVARCHAR(20);
    SELECT @id = OfferID, @status = Status FROM dbo.CoachOffers
     WHERE CoachUserID = @CoachUserID AND TraineeUserID = @TraineeUserID;

    IF @id IS NULL
    BEGIN
        INSERT INTO dbo.CoachOffers (CoachUserID, TraineeUserID, Status, CreatedAt)
        VALUES (@CoachUserID, @TraineeUserID, 'pending', SYSUTCDATETIME());
        SET @id = SCOPE_IDENTITY();
    END
    ELSE IF @status = 'declined'
    BEGIN
        UPDATE dbo.CoachOffers SET Status = 'pending', CreatedAt = SYSUTCDATETIME(), RespondedAt = NULL
         WHERE OfferID = @id;
    END

    SELECT OfferID, CoachUserID, TraineeUserID, Status, CreatedAt, RespondedAt
    FROM dbo.CoachOffers WHERE OfferID = @id;
END
GO

-- Trainee responds. On accept, create the CoachTrainees link (lazy-create
-- the coach's Coaches row if missing, mirroring CoachBL).
CREATE OR ALTER PROCEDURE dbo.sp_RespondCoachOffer
    @OfferID INT,
    @Accept  BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @coachUserId INT, @traineeUserId INT;
    SELECT @coachUserId = CoachUserID, @traineeUserId = TraineeUserID
    FROM dbo.CoachOffers WHERE OfferID = @OfferID;

    UPDATE dbo.CoachOffers
       SET Status = CASE WHEN @Accept = 1 THEN 'accepted' ELSE 'declined' END,
           RespondedAt = SYSUTCDATETIME()
     WHERE OfferID = @OfferID;

    IF @Accept = 1 AND @coachUserId IS NOT NULL AND @traineeUserId IS NOT NULL
    BEGIN
        DECLARE @coachId INT;
        SELECT @coachId = CoachID FROM dbo.Coaches WHERE UserID = @coachUserId;
        IF @coachId IS NULL
        BEGIN
            INSERT INTO dbo.Coaches (FullName, Email, UserID)
            SELECT FullName, Email, UserID FROM dbo.Users WHERE UserID = @coachUserId;
            SET @coachId = SCOPE_IDENTITY();
        END
        IF NOT EXISTS (SELECT 1 FROM dbo.CoachTrainees WHERE CoachID = @coachId AND UserID = @traineeUserId)
            INSERT INTO dbo.CoachTrainees (CoachID, UserID, ConnectionDate, AllowNotifications)
            VALUES (@coachId, @traineeUserId, CAST(SYSUTCDATETIME() AS DATE), 1);
    END

    SELECT OfferID, CoachUserID, TraineeUserID, Status FROM dbo.CoachOffers WHERE OfferID = @OfferID;
END
GO

-- Pending offers addressed TO a trainee.
CREATE OR ALTER PROCEDURE dbo.sp_GetCoachOffersForTrainee
    @TraineeUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.OfferID,
           o.CoachUserID,
           u.FullName,
           u.Email,
           u.ProfileImagePath,
           u.ExperienceLevel,
           o.CreatedAt
    FROM dbo.CoachOffers o
    JOIN dbo.Users u ON u.UserID = o.CoachUserID
    WHERE o.TraineeUserID = @TraineeUserID AND o.Status = 'pending'
    ORDER BY o.CreatedAt DESC;
END
GO

-- Offers a coach has sent (so the button can show Pending/Connected).
CREATE OR ALTER PROCEDURE dbo.sp_GetSentCoachOffers
    @CoachUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT OfferID, TraineeUserID, Status, CreatedAt
    FROM dbo.CoachOffers WHERE CoachUserID = @CoachUserID;
END
GO

-- =====================================================================
-- SEED — fake users / coaches / gyms near Netanya (32.3215, 34.8532)
-- Guarded by Email so re-running is safe. Passwords are the char(8)
-- placeholder 'demo1234'. LastSeen = now so they appear online at demo
-- time (real users keep presence fresh via the heartbeat).
-- =====================================================================

-- 6 fake trainees ------------------------------------------------------
INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Maya Cohen', 1996, 'female', 168, 60, 2, SYSUTCDATETIME(), 'Android', 'mayac', 'maya.cohen@trainwise.demo', 'demo1234', 2, 1, 1, 1, 0, 1, SYSUTCDATETIME(), 32.3240, 34.8550
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'maya.cohen@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Daniel Levi', 1992, 'male', 180, 78, 3, SYSUTCDATETIME(), 'Android', 'danl', 'daniel.levi@trainwise.demo', 'demo1234', 3, 1, 1, 1, 0, 1, SYSUTCDATETIME(), 32.3190, 34.8500
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'daniel.levi@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Noa Bar', 2000, 'female', 165, 57, 1, SYSUTCDATETIME(), 'iPhone', 'noab', 'noa.bar@trainwise.demo', 'demo1234', 1, 1, 1, 0, 0, 1, DATEADD(HOUR, -3, SYSUTCDATETIME()), 32.3260, 34.8580
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'noa.bar@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Itay Mizrahi', 1994, 'male', 175, 72, 2, SYSUTCDATETIME(), 'Android', 'itaym', 'itay.mizrahi@trainwise.demo', 'demo1234', 2, 1, 1, 1, 0, 1, SYSUTCDATETIME(), 32.3175, 34.8560
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'itay.mizrahi@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Shira Peretz', 1990, 'female', 170, 63, 3, SYSUTCDATETIME(), 'Android', 'shirap', 'shira.peretz@trainwise.demo', 'demo1234', 3, 1, 1, 1, 0, 1, SYSUTCDATETIME(), 32.3300, 34.8520
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'shira.peretz@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Omer Katz', 1998, 'male', 178, 80, 1, SYSUTCDATETIME(), 'iPhone', 'omerk', 'omer.katz@trainwise.demo', 'demo1234', 1, 1, 1, 0, 0, 1, DATEADD(DAY, -1, SYSUTCDATETIME()), 32.3150, 34.8600
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'omer.katz@trainwise.demo');

-- 4 fake coaches -------------------------------------------------------
INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Avi Shapiro', 1985, 'male', 182, 84, 3, SYSUTCDATETIME(), 'Android', 'avis', 'avi.shapiro@trainwise.demo', 'demo1234', 3, 1, 1, 1, 1, 0, SYSUTCDATETIME(), 32.3225, 34.8540
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'avi.shapiro@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Tamar Gold', 1988, 'female', 172, 64, 3, SYSUTCDATETIME(), 'iPhone', 'tamarg', 'tamar.gold@trainwise.demo', 'demo1234', 3, 1, 1, 1, 1, 0, SYSUTCDATETIME(), 32.3205, 34.8515
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'tamar.gold@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Yossi Ben-David', 1983, 'male', 177, 79, 3, SYSUTCDATETIME(), 'Android', 'yossibd', 'yossi.bendavid@trainwise.demo', 'demo1234', 3, 1, 1, 1, 1, 1, DATEADD(MINUTE, -30, SYSUTCDATETIME()), 32.3250, 34.8505
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'yossi.bendavid@trainwise.demo');

INSERT INTO dbo.Users (FullName, BirthYear, Gender, Height, Weight, ActivityLevel, CreatedAt, DeviceType, UserName, Email, Password, ExperienceLevel, HealthDeclaration, ConfirmTerms, IsBaselineEstablished, IsCoach, IsTrainee, LastSeen, Latitude, Longitude)
SELECT 'Rina Azoulay', 1991, 'female', 169, 61, 3, SYSUTCDATETIME(), 'iPhone', 'rinaa', 'rina.azoulay@trainwise.demo', 'demo1234', 3, 1, 1, 1, 1, 0, SYSUTCDATETIME(), 32.3185, 34.8575
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'rina.azoulay@trainwise.demo');

-- Coaches rows for the fake coaches -----------------------------------
INSERT INTO dbo.Coaches (FullName, Email, UserID)
SELECT u.FullName, u.Email, u.UserID
FROM dbo.Users u
WHERE u.Email IN ('avi.shapiro@trainwise.demo','tamar.gold@trainwise.demo','yossi.bendavid@trainwise.demo','rina.azoulay@trainwise.demo')
  AND NOT EXISTS (SELECT 1 FROM dbo.Coaches c WHERE c.UserID = u.UserID);
GO

-- Activity logs so the fake trainees have a top-3 (recent, confirmed) ---
-- Helper inserts: (Email, ActivityTypeID, reps) pattern, expanded inline.
;WITH seed AS (
    SELECT * FROM (VALUES
        ('maya.cohen@trainwise.demo', 1, 5),  ('maya.cohen@trainwise.demo', 9, 3),  ('maya.cohen@trainwise.demo', 3, 2),
        ('daniel.levi@trainwise.demo', 4, 6), ('daniel.levi@trainwise.demo', 5, 4), ('daniel.levi@trainwise.demo', 1, 2),
        ('noa.bar@trainwise.demo', 2, 5),     ('noa.bar@trainwise.demo', 10, 3),    ('noa.bar@trainwise.demo', 6, 2),
        ('itay.mizrahi@trainwise.demo', 3, 6),('itay.mizrahi@trainwise.demo', 1, 4),('itay.mizrahi@trainwise.demo', 4, 2),
        ('shira.peretz@trainwise.demo', 12, 6),('shira.peretz@trainwise.demo', 1, 4),('shira.peretz@trainwise.demo', 4, 2),
        ('omer.katz@trainwise.demo', 6, 5),   ('omer.katz@trainwise.demo', 2, 3),   ('omer.katz@trainwise.demo', 9, 2)
    ) v(Email, ActivityTypeID, Reps)
),
nums AS (
    SELECT TOP 6 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects
)
INSERT INTO dbo.ActivityLogs (UserID, ActivityTypeID, StartTime, EndTime, DistanceKM, AvgHeartRate, MaxHeartRate, CaloriesBurned, SourceDevice, ExertionLevel, Duration, CalculatedLoadForSession, IsConfirmed)
SELECT u.UserID, s.ActivityTypeID,
       DATEADD(DAY, -n.n, GETDATE()), DATEADD(DAY, -n.n, DATEADD(MINUTE, 45, GETDATE())),
       0, 0, 0, 0, 'Seed', 6, 45, 270, 1
FROM seed s
JOIN nums n ON n.n <= s.Reps
JOIN dbo.Users u ON u.Email = s.Email
WHERE NOT EXISTS (SELECT 1 FROM dbo.ActivityLogs al WHERE al.UserID = u.UserID AND al.SourceDevice = 'Seed');
GO

-- Gyms are DEMO-only reference data (no UI creates them), so reseed cleanly:
-- wipe and repopulate with REAL Netanya gyms harvested from Google Places, so
-- the name + Address + Lat/Lng are Google's own values and the map pin always
-- matches the displayed address. Re-running converges to this set.
DELETE FROM dbo.GymCoaches;
DELETE FROM dbo.Gyms;
GO

-- 10 REAL gyms in NETANYA (the user's city). The area easily reaches Ruppin
-- Academic Center (~6 km NE, 32.3424 / 34.9123). Harvested 2026-06-09.
INSERT INTO dbo.Gyms (Name, Address, City, Latitude, Longitude, Description, Rating, Phone)
SELECT v.Name, v.Address, v.City, v.Lat, v.Lng, v.Descr, v.Rating, v.Phone
FROM (VALUES
    ('Profit Gym',             'Sderot Oved Ben Ami 1, Netanya, Israel', 'Netanya', 32.3178473, 34.8463531, 'Central Netanya gym with free weights, machines and classes.', 3.8, '09-772-3421'),
    ('G 24/7',                 'Herzl St 5, Netanya, Israel',            'Netanya', 32.3299633, 34.8534812, '24/7 gym on Herzl St with cardio, weights and a functional area.', 5.0, '054-484-6766'),
    ('Holmes Place Natanya',   'Herzl St 60, Netanya, Israel',           'Netanya', 32.3254155, 34.8613246, 'Premium health club in Kanyon HaSharon with pool and classes.', 4.0, '09-862-4445'),
    ('Greenbody Netanya',      'Tom Lantos Blvd 10, Netanya, Israel',    'Netanya', 32.3102908, 34.8696711, 'Top-rated gym in the Momentum complex, Kiryat HaSharon.', 5.0, '053-203-0490'),
    ('Icon Fitness Netanya',   'Tom Lantos Blvd 59, Netanya, Israel',    'Netanya', 32.2956962, 34.8688011, 'Full-service fitness club in southern Netanya.', 3.7, NULL),
    ('FITTR Netanya',          'Eliezer Kaplan St 26, Netanya, Israel',  'Netanya', 32.3194323, 34.8889716, 'Modern training studio on the east side of Netanya.', 4.9, '050-695-3082'),
    ('Collegym',               'Ha-Universita St 1, Netanya, Israel',    'Netanya', 32.3070961, 34.8782137, 'Well-equipped gym by the academic college.', 4.3, '09-862-3692'),
    ('Shmeps Fit',             'HaRechev St, Netanya, Israel',           'Netanya', 32.3154221, 34.8743824, 'Functional-fitness studio with small-group coaching.', 5.0, '052-442-0115'),
    ('Reborn Netanya',         'Sderot Oved Ben Ami 2, Netanya, Israel', 'Netanya', 32.3178009, 34.8465436, 'Boutique gym and studio in central Netanya.', 3.6, '077-764-5400'),
    ('Profit Kiryat HaSharon', 'Tom Lantos Blvd 8, Netanya, Israel',     'Netanya', 32.3115684, 34.8697948, 'Profit branch in Kiryat HaSharon with weights and cardio.', 3.5, '077-604-7979')
) v(Name, Address, City, Lat, Lng, Descr, Rating, Phone);
GO

-- Link fake coaches to these gyms (recommended coaches) ----------------
INSERT INTO dbo.GymCoaches (GymID, CoachUserID)
SELECT g.GymID, u.UserID
FROM (VALUES
    ('Holmes Place Natanya',   'avi.shapiro@trainwise.demo'),
    ('Holmes Place Natanya',   'tamar.gold@trainwise.demo'),
    ('Greenbody Netanya',      'yossi.bendavid@trainwise.demo'),
    ('Profit Gym',             'avi.shapiro@trainwise.demo'),
    ('FITTR Netanya',          'rina.azoulay@trainwise.demo'),
    ('Collegym',               'tamar.gold@trainwise.demo'),
    ('Shmeps Fit',             'rina.azoulay@trainwise.demo'),
    ('G 24/7',                 'yossi.bendavid@trainwise.demo'),
    ('Icon Fitness Netanya',   'avi.shapiro@trainwise.demo')
) m(GymName, Email)
JOIN dbo.Gyms g ON g.Name = m.GymName
JOIN dbo.Users u ON u.Email = m.Email
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.GymCoaches gc WHERE gc.GymID = g.GymID AND gc.CoachUserID = u.UserID
);
GO
