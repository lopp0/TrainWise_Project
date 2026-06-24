-- Item 9 — let Workout Board posts carry a photo.
-- Idempotent: safe to re-run. Run on BOTH local SQL Express and Azure SQL.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.WorkoutPosts') AND name = 'ImagePath'
)
BEGIN
    ALTER TABLE dbo.WorkoutPosts ADD ImagePath NVARCHAR(300) NULL;
END
GO
