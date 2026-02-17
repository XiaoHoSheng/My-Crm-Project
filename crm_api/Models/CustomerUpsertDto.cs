namespace crm_api.Models;

/// <summary>
/// 用于“新增 / 修改”客户时接收前端传来的数据（请求 Body）
/// Upsert = Insert(新增) + Update(更新)
/// 注意：这里一般不放数据库自增主键 Id（新增时数据库生成；更新时 Id 放在 URL）
/// </summary>
public class CustomerUpsertDto
{
    /// <summary>
    /// 客户编号（业务编号，不是数据库自增Id）
    /// 例如：20220007
    /// </summary>
    public int? CustomerId { get; set; }

    /// <summary>
    /// 客户等级/级别（例如：高/中/低）
    /// </summary>
    public string? Grade { get; set; }

    /// <summary>
    /// 客户名称（一般建议必填）
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// 注册/录入时间
    /// </summary>
    public DateTime? RegistrationTime { get; set; }

    /// <summary>
    /// 联系人姓名
    /// </summary>
    public string? ContactPerson { get; set; }

    /// <summary>
    /// 联系电话
    /// </summary>
    public string? Phone { get; set; }

    /// <summary>
    /// 邮箱
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// 地址
    /// </summary>
    public string? Address { get; set; }

    /// <summary>
    /// 客户类型ID（例如：1000/2000/3000）
    /// 对应 tb_customer_type 之类的表（如果你有）
    /// </summary>
    public int? CustomerTypeId { get; set; }
}
