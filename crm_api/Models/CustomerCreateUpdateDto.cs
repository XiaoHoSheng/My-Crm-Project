using System.ComponentModel.DataAnnotations;

namespace crm_api.Models;

/// <summary>
/// CustomerCreateUpdateDto：用来承载“新增/更新”时前端传入的数据（API 入参）
/// 注意：这里不需要 Id（Id 是数据库自增出来的）
/// </summary>
public class CustomerCreateUpdateDto
{
    [Required]
    public long CustomerId { get; set; }

    public string? Grade { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public DateTime? RegistrationTime { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public int? CustomerTypeId { get; set; }
}
