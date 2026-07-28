namespace TrainWise.BL.Models
{
    // Lightweight projection of a coach as seen by a trainee: enough to open a
    // chat (CoachUserID = the coach's Users row id) and render a header.
    public class CoachContact
    {
        public int CoachID { get; set; }
        public int CoachUserID { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string ProfileImagePath { get; set; }
    }
}
