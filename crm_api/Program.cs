using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ✅ Controllers
builder.Services.AddControllers();

// ✅ 依赖注入：注册所有的 Repository
builder.Services.AddScoped<crm_api.Repositories.CustomerRepository>();
builder.Services.AddScoped<crm_api.Repositories.CustomerTypeRepository>();
builder.Services.AddScoped<crm_api.Repositories.OpportunityRepository>();
builder.Services.AddScoped<crm_api.Repositories.DashboardRepository>();
// 👇 这里是我们刚才为了登录新加的 UserRepository 👇
builder.Services.AddScoped<crm_api.Repositories.UserRepository>();


// ✅ 新增：配置 JWT 身份验证
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });


// ✅ CORS：允许前端 Vite 跨域访问
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVite", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ✅ Swagger 配置
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ 中间件顺序非常重要：Cors -> Authentication -> Authorization -> MapControllers
app.UseCors("AllowVite");

// 👇 新增：启用身份验证和授权管道 👇
app.UseAuthentication(); 
app.UseAuthorization();

app.MapControllers();
app.Run();