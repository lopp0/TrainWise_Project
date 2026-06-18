using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class LoadParametersBL
    {
        private readonly LoadParametersDAL _dal = new LoadParametersDAL();

        public LoadParameters GetParameters()
        {
            var parameters = _dal.GetLoadParameters();

            if (parameters == null)
                throw new Exception("Load parameters not found in database");

            return parameters;
        }
    }
}
