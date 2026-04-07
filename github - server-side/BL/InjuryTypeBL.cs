using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class InjuryTypeBL
    {
        private readonly InjuryTypeDAL _dal = new InjuryTypeDAL();

        public List<InjuryType> GetAll()
        {
            return _dal.GetAll();
        }
    }
}
