namespace crm_api.Models;

/// <summary>
/// ApiError：统一错误返回结构（前端看到就知道怎么处理）
/// </summary>
public class ApiError
{
    public string Code { get; set; } = "error"; // 比如：validation_error / not_found / conflict / mysql_error
    public string Message { get; set; } = "Something went wrong";
    public object? Details { get; set; } // 可选：放更多信息
}
