namespace crm_api.Models;

/// <summary>
/// 新增客户类型请求体
/// </summary>
public class CreateCustomerTypeDto
{
    public int TypeId { get; set; }
    public string? Name { get; set; }
}
