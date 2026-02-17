namespace crm_api.Models;

/// <summary>
/// 客户类型 DTO（对外返回/接收用）
/// 对应表：tb_customer_type
/// 字段：id, type_id, name
/// </summary>
public class CustomerTypeDto
{
    /// <summary>数据库主键</summary>
    public int Id { get; set; }

    /// <summary>业务上的类型编号（表里叫 type_id）</summary>
    public int TypeId { get; set; }

    /// <summary>类型名称</summary>
    public string? Name { get; set; }
}
