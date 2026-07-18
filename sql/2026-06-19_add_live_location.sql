-- ============================================================================
-- A-2 : optional live location sharing on the Connect map (double opt-in).
-- Adds Users.ShareLiveLocation (default 0 = OFF). The proximity LIST still
-- works for everyone (distance from stored coords), but the map only ever
-- receives coordinates for users who opted in — others get NULL coords so no
-- pin is plotted (privacy, mirrors lesson 2026-06-09). Opting out keeps the
-- stored coords (so the user stays in proximity lists) but stops exposing them.
-- Idempotent. Run on local SQL Express (TrainWise) AND Azure SQL.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'ShareLiveLocation')
    ALTER TABLE dbo.Users ADD ShareLiveLocation BIT NOT NULL CONSTRAINT DF_Users_ShareLiveLocation DEFAULT 0;
GO

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
           -- Only opted-in users expose real coords to the map.
           CASE WHEN u.ShareLiveLocation = 1 THEN u.Latitude  ELSE NULL END AS Latitude,
           CASE WHEN u.ShareLiveLocation = 1 THEN u.Longitude ELSE NULL END AS Longitude,
           ISNULL(u.ShareLiveLocation, 0) AS ShareLiveLocation,
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

CREATE OR ALTER PROCEDURE dbo.sp_SetShareLiveLocation
    @UserID INT,
    @Share  BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET ShareLiveLocation = @Share WHERE UserID = @UserID;
END
GO
