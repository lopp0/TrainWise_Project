using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // A-5 — plain parameterized SQL (no stored procs needed; the migration only
    // creates the two tables).
    public class RecordsDAL : DBservice
    {
        public List<PersonalRecord> GetRecords(int userId)
        {
            var list = new List<PersonalRecord>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "SELECT RecordId, UserID, ActivityTypeId, MetricType, RecordValue, AchievedAt, LinkedLogId " +
                "FROM dbo.PersonalRecords WHERE UserID=@u", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                        list.Add(new PersonalRecord
                        {
                            RecordId = (int)r["RecordId"],
                            UserID = (int)r["UserID"],
                            ActivityTypeId = r["ActivityTypeId"] as int?,
                            MetricType = r["MetricType"].ToString(),
                            RecordValue = Convert.ToDouble(r["RecordValue"]),
                            AchievedAt = (DateTime)r["AchievedAt"],
                            LinkedLogId = r["LinkedLogId"] as int?
                        });
            }
            return list;
        }

        public List<EarnedBadge> GetBadges(int userId)
        {
            var list = new List<EarnedBadge>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "SELECT BadgeId, UserID, BadgeKey, EarnedAt FROM dbo.EarnedBadges " +
                "WHERE UserID=@u ORDER BY EarnedAt DESC", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                        list.Add(new EarnedBadge
                        {
                            BadgeId = (int)r["BadgeId"],
                            UserID = (int)r["UserID"],
                            BadgeKey = r["BadgeKey"].ToString(),
                            EarnedAt = (DateTime)r["EarnedAt"]
                        });
            }
            return list;
        }

        public void UpsertRecord(int userId, string metricType, double value, DateTime achievedAt, int? linkedLogId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(@"
IF EXISTS (SELECT 1 FROM dbo.PersonalRecords WHERE UserID=@u AND MetricType=@m AND ActivityTypeId IS NULL)
    UPDATE dbo.PersonalRecords SET RecordValue=@v, AchievedAt=@a, LinkedLogId=@l
        WHERE UserID=@u AND MetricType=@m AND ActivityTypeId IS NULL;
ELSE
    INSERT INTO dbo.PersonalRecords (UserID, ActivityTypeId, MetricType, RecordValue, AchievedAt, LinkedLogId)
        VALUES (@u, NULL, @m, @v, @a, @l);", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                cmd.Parameters.AddWithValue("@m", metricType);
                cmd.Parameters.AddWithValue("@v", value);
                cmd.Parameters.AddWithValue("@a", achievedAt);
                cmd.Parameters.AddWithValue("@l", (object?)linkedLogId ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }

        // Returns true if the badge was newly inserted (not already earned).
        public bool AwardBadge(int userId, string badgeKey)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(@"
DECLARE @existed INT = (SELECT COUNT(*) FROM dbo.EarnedBadges WHERE UserID=@u AND BadgeKey=@k);
IF @existed = 0
    INSERT INTO dbo.EarnedBadges (UserID, BadgeKey) VALUES (@u, @k);
SELECT CASE WHEN @existed = 0 THEN 1 ELSE 0 END;", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                cmd.Parameters.AddWithValue("@k", badgeKey);
                return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
            }
        }
    }
}
