namespace crm_api.Models;

/// <summary>
/// 统一接口返回结构：前端只需要判断 success，然后看 data / message / errors
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    public object? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResponse<T> Fail(string message, object? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}
