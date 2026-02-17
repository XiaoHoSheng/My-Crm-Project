using Microsoft.AspNetCore.Mvc;

namespace crm_api.Controllers;

/// <summary>
/// 示例接口：WeatherForecast
/// 用途：演示 API 正常工作、Swagger 显示、返回 JSON
/// 路由：GET /weatherforecast
/// </summary>
[ApiController]
[Route("weatherforecast")] // ✅ 固定路由，避免大小写问题
public class WeatherForecastController : ControllerBase
{
    // 静态数组：返回随机天气描述（演示用）
    private static readonly string[] Summaries =
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild",
        "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    /// <summary>
    /// GET /weatherforecast
    /// 返回 5 条随机天气数据（演示用）
    /// </summary>
    [HttpGet]
    public ActionResult<IEnumerable<WeatherForecastDto>> Get()
    {
        // 生成 1~5 的索引，然后构造 DTO 数组返回
        var forecast = Enumerable.Range(1, 5).Select(index =>
            new WeatherForecastDto(
                DateOnly.FromDateTime(DateTime.Now.AddDays(index)), // 日期：今天往后 index 天
                Random.Shared.Next(-20, 55),                        // 温度：随机 -20~55
                Summaries[Random.Shared.Next(Summaries.Length)]     // 描述：随机取一个
            ))
            .ToArray();

        // 返回 200 + JSON
        return Ok(forecast);
    }
}

/// <summary>
/// DTO：返回给前端的数据结构（Data Transfer Object）
/// 用 Dto 命名，避免你项目里已有 WeatherForecast 类型导致“重复定义”
/// </summary>
public record WeatherForecastDto(DateOnly Date, int TemperatureC, string? Summary)
{
    // 摄氏转华氏（演示用）
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
