using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class InjuryTypeDAL : DBservice
    {
        public List<InjuryType> GetAll()
        {
            var list = new List<InjuryType>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetAllInjuryTypes", con, null))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new InjuryType
                    {
                        InjuryTypeID = (int)reader["InjuryTypeID"],
                        InjuryName = reader["InjuryName"].ToString()
                    });
                }
            }
            return list;
        }
    }
}

