namespace crm_api.Models;

/// <summary>
/// CustomerDto：API 返回给前端的“客户数据”
/// 注意：这里字段名用 C# 的 PascalCase（CustomerTypeId）
/// Dapper 会用 SQL 里的 AS 映射到这些属性名
/// </summary>
public class CustomerDto
{
    public int Id { get; set; }
    public int? CustomerId { get; set; }
    public string? Grade { get; set; }
    public string? Name { get; set; }
    public DateTime? RegistrationTime { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public int? CustomerTypeId { get; set; }

    /// <summary>
    /// ✅ 新增：客户类型名称（来自 tb_customer_type.name）
    /// </summary>
    public string? CustomerTypeName { get; set; }
}
