-- =====================================================================
-- TrainWise migration: monthly training forecast snapshots
-- Feature: Coach analytics + ML forecast (Python service). Date: 2026-06-12
--
-- Run AFTER the schema + all earlier migrations. No dependency on seed
-- data. Idempotent: table guarded by IF NOT EXISTS, index by IF NOT EXISTS.
--
-- Adds:
--   * MonthlyForecasts  (append-only forecast snapshots, one per refresh)
--
-- The Python ML service (ml/app.py) writes rows here directly via pyodbc;
-- there is NO C# / stored-procedure code for this table. Each forecast
-- generation inserts a new row, so a month accumulates a history of
-- increasingly-precise snapshots. "Current" = latest GeneratedAt per
-- (TraineeUserID, MonthKey). A new MonthKey starts a fresh series, and old
-- months stay queryable for later analysis.
--
-- ModelType values: 'naive' (week 1, carry-forward), 'linear', 'poly2',
--                   'global' (notebook-trained model prediction).
-- RiskClass values: 'Safe' | 'Warning' | 'High'.
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MonthlyForecasts' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.MonthlyForecasts (
        ForecastID          INT IDENTITY(1,1) NOT NULL,
        TraineeUserID       INT NOT NULL,                 -- Users.UserID of the trainee
        MonthKey            CHAR(7) NOT NULL,             -- 'YYYY-MM' calendar month the forecast is for
        AsOfDate            DATE NOT NULL,                -- the through-date the projection was computed from
        WeeksElapsed        INT NOT NULL,                 -- completed month-weeks used to fit (1..5)
        WorkoutsThisMonth   INT NOT NULL CONSTRAINT DF_MonthlyForecasts_Workouts DEFAULT (0),
        CurrentACRatio      FLOAT NULL,                   -- AC ratio as of AsOfDate
        CurrentChronic      FLOAT NULL,                   -- chronic load (28d sum / 4) as of AsOfDate
        ProjectedACRatio    FLOAT NULL,                   -- headline end-of-month projected AC ratio
        ProjectedAcuteLoad  FLOAT NULL,                   -- headline end-of-month projected acute load
        ProjectedJson       NVARCHAR(MAX) NULL,           -- full per-week projection array (JSON)
        ModelType           NVARCHAR(20) NOT NULL CONSTRAINT DF_MonthlyForecasts_Model DEFAULT ('naive'),
        R2                  FLOAT NULL,                   -- fit quality / confidence of the per-trainee model
        RiskClass           NVARCHAR(20) NULL,            -- Safe | Warning | High
        GeneratedAt         DATETIME2 NOT NULL CONSTRAINT DF_MonthlyForecasts_Generated DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_MonthlyForecasts PRIMARY KEY CLUSTERED (ForecastID ASC)
    );
END
GO

-- Fast lookup of the latest snapshot per trainee+month, and history listing.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MonthlyForecasts_Trainee_Month' AND object_id = OBJECT_ID('dbo.MonthlyForecasts'))
BEGIN
    CREATE INDEX IX_MonthlyForecasts_Trainee_Month
        ON dbo.MonthlyForecasts (TraineeUserID, MonthKey, GeneratedAt DESC);
END
GO
