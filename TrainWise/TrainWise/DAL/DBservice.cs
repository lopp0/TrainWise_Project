using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class DBservice
    {
        // יצירת חיבור למסד הנתונים
        protected SqlConnection Connect()
        {
            // Read config with environment variables taking precedence over the
            // JSON file. This lets the connection string (which carries the Azure
            // SQL password) live ONLY in the hosting platform's config — Azure App
            // Service "Connection strings"/"Application settings" inject it as the
            // env var ConnectionStrings__DefaultConnection (or SQLAZURECONNSTR_*),
            // so the secret never has to sit in the committed appsettings.json.
            // SetBasePath(AppContext.BaseDirectory) makes the JSON resolve
            // regardless of the process working directory.
            IConfigurationRoot configuration = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
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
