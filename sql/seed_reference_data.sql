-- =====================================================================
-- TrainWise — reference / lookup seed data
-- Run on a FRESH database (local SQL Express "TrainWise" or a future
-- Azure/Oracle DB) AFTER the schema + stored procs (TWDB.sql) and the
-- migrations have been applied. Populates the lookup tables the app needs
-- for its dropdowns and the training-load algorithm.
--
-- The repo's TWDB.sql / TrainWisev0.sql are schema + procs ONLY — this is
-- the canonical seed data (captured 2026-06-07). Each block is guarded by
-- IF NOT EXISTS so the script is safe to re-run (it won't duplicate rows).
-- =====================================================================

USE [TrainWise];
GO

-- ───── ActivityTypes (TypeName + IntensityFactor used by the load calc) ─────
IF NOT EXISTS (SELECT 1 FROM dbo.ActivityTypes)
BEGIN
    SET IDENTITY_INSERT dbo.ActivityTypes ON;
    INSERT INTO dbo.ActivityTypes ([ActivityTypeID], [TypeName], [IntensityFactor]) VALUES
        (1,  N'Running',        1.30),
        (2,  N'Walking',        0.80),
        (3,  N'Cycling',        1.20),
        (4,  N'Gym',            1.30),
        (5,  N'HIIT',           1.40),
        (6,  N'Swimming',       1.20),
        (7,  N'Trail Running',  1.30),
        (8,  N'Hiking',         1.30),
        (9,  N'Yoga',           1.00),
        (10, N'Pilates',        1.00),
        (11, N'Rowing',         1.20),
        (12, N'CrossFit',       1.50),
        (13, N'Elliptical',     1.10),
        (14, N'Spin Class',     1.20),
        (15, N'Nordic Walking', 0.80),
        (16, N'Brisk Walk',     0.80),
        (17, N'Treadmill Run',  1.30),
        (18, N'Powerlifting',   1.30),
        (19, N'Interval Run',   1.30),
        (20, N'Stair Climb',    1.10);
    SET IDENTITY_INSERT dbo.ActivityTypes OFF;
END
GO

-- ───── InjuryTypes ─────
IF NOT EXISTS (SELECT 1 FROM dbo.InjuryTypes)
BEGIN
    SET IDENTITY_INSERT dbo.InjuryTypes ON;
    INSERT INTO dbo.InjuryTypes ([InjuryTypeID], [InjuryName]) VALUES
        (1,  N'Knee Pain'),
        (2,  N'Shin Splints'),
        (3,  N'Lower Back Pain'),
        (4,  N'Ankle Sprain'),
        (5,  N'Hamstring Strain'),
        (6,  N'ITB Syndrome'),
        (7,  N'Achilles Tendinopathy'),
        (8,  N'Plantar Fasciitis'),
        (9,  N'Shoulder Impingement'),
        (10, N'Wrist Strain'),
        (11, N'Neck Strain'),
        (12, N'Quadriceps Strain'),
        (13, N'Groin Pull'),
        (14, N'Hip Flexor Pain'),
        (15, N'Calf Strain'),
        (16, N'Rib Stress Injury'),
        (17, N'Foot Blister'),
        (18, N'Stress Fracture'),
        (19, N'Tendonitis'),
        (20, N'Patellar Tendinopathy');
    SET IDENTITY_INSERT dbo.InjuryTypes OFF;
END
GO

-- ───── InjuryCategories (no IDENTITY; InjuryTypeID is the FK) ─────
IF NOT EXISTS (SELECT 1 FROM dbo.InjuryCategories)
BEGIN
    INSERT INTO dbo.InjuryCategories ([InjuryTypeID], [CategoryName]) VALUES
        (1,  N'Overload'),
        (2,  N'Running-related'),
        (3,  N'Posture-related'),
        (4,  N'Impact'),
        (5,  N'Muscle'),
        (6,  N'Overuse'),
        (7,  N'Tendon'),
        (8,  N'Plantar'),
        (9,  N'Repetitive'),
        (10, N'Acute'),
        (11, N'Tension'),
        (12, N'Muscle'),
        (13, N'Groin'),
        (14, N'Flexor'),
        (15, N'Muscle'),
        (16, N'Stress'),
        (17, N'Friction'),
        (18, N'Bone'),
        (19, N'Tendon'),
        (20, N'Patellar');
END
GO

-- ───── LoadParameters (single tuning row for the AC-ratio / overload calc) ─────
IF NOT EXISTS (SELECT 1 FROM dbo.LoadParameters)
BEGIN
    SET IDENTITY_INSERT dbo.LoadParameters ON;
    INSERT INTO dbo.LoadParameters
        ([ParamID], [BeginnerDailyLoad], [RegularDailyLoad], [AdvanceDailyLoad],
         [BeginnerAcuteLoad], [RegularAcuteLoad], [AdvanceAcuteLoad],
         [LowLoadRatio], [SafeZoneLowRange], [SafeZoneHighRange], [OverLoad])
    VALUES (1, 200, 350, 500, 150, 280, 420, 0.8, 0.8, 1.3, 1.5);
    SET IDENTITY_INSERT dbo.LoadParameters OFF;
END
GO

-- ───── TrainingGoals ─────
IF NOT EXISTS (SELECT 1 FROM dbo.TrainingGoals)
BEGIN
    SET IDENTITY_INSERT dbo.TrainingGoals ON;
    INSERT INTO dbo.TrainingGoals ([GoalID], [GoalName]) VALUES
        (1,  N'Weight Loss'),
        (2,  N'Improve Endurance'),
        (3,  N'Build Muscle'),
        (4,  N'Marathon Preparation'),
        (5,  N'General Fitness'),
        (6,  N'Injury Prevention'),
        (7,  N'Rehabilitation'),
        (8,  N'Speed Improvement'),
        (9,  N'Power Development'),
        (10, N'Flexibility'),
        (11, N'Cross Training'),
        (12, N'5K Preparation'),
        (13, N'10K Preparation'),
        (14, N'Half Marathon Prep'),
        (15, N'Core Strength'),
        (16, N'Balance & Mobility'),
        (17, N'HIIT Performance'),
        (18, N'Long Run Stamina'),
        (19, N'Cycling Endurance'),
        (20, N'Improve Recovery');
    SET IDENTITY_INSERT dbo.TrainingGoals OFF;
END
GO
