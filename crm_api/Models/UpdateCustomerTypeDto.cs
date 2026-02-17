namespace crm_api.Models;

/// <summary>
/// 更新客户类型请求体
/// </summary>
public class UpdateCustomerTypeDto
{
    public int TypeId { get; set; }
    public string? Name { get; set; }
}
