-- =====================================================================
-- TrainWise — export all DB data
-- Run in SSMS connected to  Lirone\SQLEXPRESS  →  database "TrainWise".
--
-- The repo's TWDB.sql / TrainWisev0.sql contain SCHEMA + STORED PROCS only
-- (no data rows). This script reads whatever is actually in your live DB.
--
-- HOW TO USE
--   1. Open in SSMS, make sure "TrainWise" is the selected database.
--   2. For Section A (view): just run — results show in the grid.
--   3. For Section B (get INSERTs): switch output to TEXT first
--      (menu: Query → Results To → Results To Text, or Ctrl+T), then run.
--      Copy the generated INSERT lines into a seed file.
-- =====================================================================

USE TrainWise;
GO

-- =====================================================================
-- SECTION A — see every row in every table (run with Results To Grid)
-- =====================================================================
SELECT * FROM dbo.Users;
SELECT * FROM dbo.Coaches;
SELECT * FROM dbo.CoachTrainees;
SELECT * FROM dbo.ActivityTypes;
SELECT * FROM dbo.ActivityLogs;
SELECT * FROM dbo.DailyLoad;
SELECT * FROM dbo.InjuryTypes;
SELECT * FROM dbo.InjuryCategories;
SELECT * FROM dbo.InjuriesReports;
SELECT * FROM dbo.TrainingGoals;
SELECT * FROM dbo.UserTrainingGoals;
SELECT * FROM dbo.UserActivityPreferences;
SELECT * FROM dbo.UserDevices;
SELECT * FROM dbo.Recommendations;
SELECT * FROM dbo.CoachRecommendations;
SELECT * FROM dbo.LoadParameters;
-- Messages exists only after the 2026-06-04 migration:
IF OBJECT_ID('dbo.Messages','U') IS NOT NULL SELECT * FROM dbo.Messages;
GO

-- Quick row-count overview of the whole DB
SELECT t.name AS [Table], SUM(p.rows) AS [Rows]
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY t.name
ORDER BY t.name;
GO

-- =====================================================================
-- SECTION B — generate INSERT statements for the REFERENCE / LOOKUP
-- tables (the data needed to seed a fresh DB). Run with Results To Text.
-- Each query prints ready-to-paste INSERTs that preserve the original IDs.
-- =====================================================================

-- ---- ActivityTypes ----
PRINT 'SET IDENTITY_INSERT dbo.ActivityTypes ON;';
SELECT 'INSERT INTO dbo.ActivityTypes (ActivityTypeID, TypeName, IntensityFactor) VALUES ('
     + CAST(ActivityTypeID AS varchar(10)) + ', N'''
     + REPLACE(TypeName, '''', '''''') + ''', '
     + ISNULL(CAST(IntensityFactor AS varchar(20)), 'NULL') + ');'
FROM dbo.ActivityTypes ORDER BY ActivityTypeID;
PRINT 'SET IDENTITY_INSERT dbo.ActivityTypes OFF;';
GO

-- ---- InjuryTypes ----
PRINT 'SET IDENTITY_INSERT dbo.InjuryTypes ON;';
SELECT 'INSERT INTO dbo.InjuryTypes (InjuryTypeID, InjuryName) VALUES ('
     + CAST(InjuryTypeID AS varchar(10)) + ', N'''
     + REPLACE(InjuryName, '''', '''''') + ''');'
FROM dbo.InjuryTypes ORDER BY InjuryTypeID;
PRINT 'SET IDENTITY_INSERT dbo.InjuryTypes OFF;';
GO

-- ---- InjuryCategories (no identity; composite key) ----
SELECT 'INSERT INTO dbo.InjuryCategories (InjuryTypeID, CategoryName) VALUES ('
     + CAST(InjuryTypeID AS varchar(10)) + ', N'''
     + REPLACE(CategoryName, '''', '''''') + ''');'
FROM dbo.InjuryCategories ORDER BY InjuryTypeID, CategoryName;
GO

-- ---- TrainingGoals ----
PRINT 'SET IDENTITY_INSERT dbo.TrainingGoals ON;';
SELECT 'INSERT INTO dbo.TrainingGoals (GoalID, GoalName) VALUES ('
     + CAST(GoalID AS varchar(10)) + ', N'''
     + REPLACE(GoalName, '''', '''''') + ''');'
FROM dbo.TrainingGoals ORDER BY GoalID;
PRINT 'SET IDENTITY_INSERT dbo.TrainingGoals OFF;';
GO

-- ---- LoadParameters (the training-load algorithm's tuning row) ----
PRINT 'SET IDENTITY_INSERT dbo.LoadParameters ON;';
SELECT 'INSERT INTO dbo.LoadParameters (ParamID, BeginnerDailyLoad, RegularDailyLoad, AdvanceDailyLoad, BeginnerAcuteLoad, RegularAcuteLoad, AdvanceAcuteLoad, LowLoadRatio, SafeZoneLowRange, SafeZoneHighRange, OverLoad) VALUES ('
     + CAST(ParamID AS varchar(10)) + ', '
     + ISNULL(CAST(BeginnerDailyLoad AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(RegularDailyLoad  AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(AdvanceDailyLoad  AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(BeginnerAcuteLoad AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(RegularAcuteLoad  AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(AdvanceAcuteLoad  AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(LowLoadRatio      AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(SafeZoneLowRange  AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(SafeZoneHighRange AS varchar(20)), 'NULL') + ', '
     + ISNULL(CAST(OverLoad          AS varchar(20)), 'NULL') + ');'
FROM dbo.LoadParameters ORDER BY ParamID;
PRINT 'SET IDENTITY_INSERT dbo.LoadParameters OFF;';
GO
