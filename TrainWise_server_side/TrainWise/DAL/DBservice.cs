using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class DBservice
    {
        // יצירת חיבור למסד הנתונים
        protected SqlConnection Connect()
        {
            IConfigurationRoot configuration = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json")
                .Build();

            string cStr = configuration.GetConnectionString("DefaultConnection");

            SqlConnection con = new SqlConnection(cStr);
            con.Open();
            return con;
        }

        // יצירת פקודת Stored Procedure לשימוש כללי
        protected SqlCommand CreateCommandWithStoredProcedure(string spName, SqlConnection con, Dictionary<string, object> paramDic)
        {
            SqlCommand cmd = new SqlCommand
            {
                Connection = con,
                CommandText = spName,
                CommandTimeout = 10,
                CommandType = System.Data.CommandType.StoredProcedure
            };

            if (paramDic != null)
            {
                foreach (var param in paramDic)
                {
                    cmd.Parameters.AddWithValue(param.Key, param.Value);
                }
            }

            return cmd;
        }
    }
}
