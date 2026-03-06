using Beelina.LIB.Helpers.Classes;
using Beelina.API.Helpers.Extensions;
using Beelina.LIB.Interfaces;
using Beelina.LIB.Models;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;
var services = builder.Services;

// Add services to the container.
services.AddControllers();
services.AddHealthChecks();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
services.AddEndpointsApiExplorer();
services.AddSwaggerGen();

#region "Register Logger"
services.RegisterServiceLog();
#endregion

#region "Register Services"
services.RegisterServiceRepositories();

// GraphQL Services
services.RegisterGraphQLService();

// Register IOptions pattern for AppSettings section
services.Configure<ApplicationSettings>(configuration.GetSection("AppSettings"));

// Register IOptions pattern for EmailServerSettings section
services.Configure<EmailServerSettings>(configuration.GetSection("EmailServerSettings"));

// Register IOptions pattern for AppHostInfo section
services.Configure<AppHostInfo>(configuration.GetSection("AppHostInfo"));

// Register IOptions pattern for DbUserAccountDefaultsSettings section
services.Configure<DbUserAccountDefaultsSettings>(configuration.GetSection("DbUserAccountDefaultsSettings"));

configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: false, reloadOnChange: true);

// Register Automapper
services.AddAutoMapper(typeof(Program).Assembly);
#endregion

#region "Database connection to Beelina System Database"
services.RegisterDatabaseService(configuration);
#endregion

#region "JWT Authentication Setup"
services.RegisterServiceAuthentication(configuration);
#endregion

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(x => x
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());

app.UseMiddleware<LoggingScopeMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/health");

app.MapGraphQL("/graphql");

app.MapGet("/", async ([Service] IClientRepository<Client> clientRepository) => await clientRepository.GetCompanyInfoByName("BeelinaDeveloper"));

app.Run();