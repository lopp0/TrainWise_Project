
namespace TrainWise
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            // Local-LAN mode (see src/config/backend.js) talks to this API over
            // plain HTTP on 5249. Redirecting to HTTPS here would bounce those
            // requests to the self-signed dev cert on 7249, which the mobile
            // app doesn't trust — so only redirect outside Development.
            if (!app.Environment.IsDevelopment())
            {
                app.UseHttpsRedirection();
            }

                
            app.UseStaticFiles();
            app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());


            app.UseAuthorization();


            app.MapControllers();

            app.Run();
        }
    }
}
