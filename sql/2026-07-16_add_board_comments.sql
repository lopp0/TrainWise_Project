/* ============================================================================
   2026-07-16 — #143 Comments on workout-board posts (+ nested replies).
   Idempotent; run on local SQL Express (TrainWise) AND Azure SQL.

   One-level nesting: a comment on a post has ParentCommentId = NULL; a reply to
   a comment carries that comment's id. Deleting a post cascades its comments;
   deleting a parent comment cascades its replies (self-reference, handled in the
   DELETE proc since SQL Server won't allow a cascading self-FK).
   ============================================================================ */

IF OBJECT_ID('dbo.WorkoutPostComments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkoutPostComments (
        CommentId       INT IDENTITY(1,1) PRIMARY KEY,
        PostId          INT NOT NULL,
        UserID          INT NOT NULL,
        ParentCommentId INT NULL,          -- NULL = top-level comment, else a reply
        [Text]          NVARCHAR(500) NOT NULL,
        CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_WorkoutPostComments_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_WorkoutPostComments_Post FOREIGN KEY (PostId)
            REFERENCES dbo.WorkoutPosts(PostId) ON DELETE CASCADE,
        CONSTRAINT FK_WorkoutPostComments_User FOREIGN KEY (UserID)
            REFERENCES dbo.Users(UserID)
    );
    CREATE INDEX IX_WorkoutPostComments_Post ON dbo.WorkoutPostComments(PostId, CreatedAt);
END
GO
