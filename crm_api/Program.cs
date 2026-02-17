using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// ✅ Controllers
builder.Services.AddControllers();

// ✅ 依赖注入：Repository
builder.Services.AddScoped<crm_api.Repositories.CustomerRepository>();
builder.Services.AddScoped<crm_api.Repositories.CustomerTypeRepository>();

// ✅ CORS：允许前端 Vite 访问
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVite", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ✅ Swagger
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

// ✅ 必须在 MapControllers() 之前
app.UseCors("AllowVite");

app.MapControllers();
app.Run();














// using System.Reflection;

// var builder = WebApplication.CreateBuilder(args);

// // ✅ 1) 启用 MVC Controllers（CustomersController 等才会生效）
// builder.Services.AddControllers();

// // ✅ 2) 注册你自己的 Repository（依赖注入）
// // Customers

// //builder.Services.AddScoped<crm_api.Repositories.CustomerTypeRepository>();
// builder.Services.AddScoped<crm_api.Repositories.CustomerRepository>();
// builder.Services.AddScoped<crm_api.Repositories.CustomerTypeRepository>();

// // CustomerTypes（如果你还没创建这个类，可以先注释掉这一行）
// // builder.Services.AddScoped<crm_api.Repositories.CustomerTypeRepository>();

// // ✅ 3) Swagger（API 文档）
// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen(c =>
// {
//     // ✅ 让 Swagger 读取 XML 注释（你写的 /// <summary> 才会显示）
//     var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
//     var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);

//     // 文件不存在也不报错（避免第一次没开 XML 输出时崩掉）
//     if (File.Exists(xmlPath))
//     {
//         c.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
//     }
// });

// var app = builder.Build();

// // ✅ 4) 开发环境开启 Swagger UI
// if (app.Environment.IsDevelopment())
// {
//     app.UseSwagger();
//     app.UseSwaggerUI();
// }


// // ✅ 5) 映射所有 Controller 路由（/api/Customers 等）
// app.MapControllers();
// app.Run();
