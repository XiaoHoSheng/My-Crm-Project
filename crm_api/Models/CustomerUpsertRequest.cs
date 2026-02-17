using System.ComponentModel.DataAnnotations;

namespace crm_api.Models;

/// <summary>
/// 新增/更新客户用的请求体（Swagger 里填写 JSON 用）
/// </summary>
public class CustomerUpsertRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "customerId 必须是正整数")]
    public int CustomerId { get; set; }

    [Required]
    [StringLength(10, ErrorMessage = "grade 最长 10 个字符")]
    public string Grade { get; set; } = "";

    [Required]
    [StringLength(100, ErrorMessage = "name 最长 100 个字符")]
    public string Name { get; set; } = "";

    public DateTime? RegistrationTime { get; set; }

    [StringLength(100, ErrorMessage = "contactPerson 最长 100 个字符")]
    public string? ContactPerson { get; set; }

    [StringLength(30, ErrorMessage = "phone 最长 30 个字符")]
    public string? Phone { get; set; }

    [EmailAddress(ErrorMessage = "email 格式不正确")]
    [StringLength(100, ErrorMessage = "email 最长 100 个字符")]
    public string? Email { get; set; }

    [StringLength(255, ErrorMessage = "address 最长 255 个字符")]
    public string? Address { get; set; }

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "customerTypeId 必须是正整数")]
    public int CustomerTypeId { get; set; }
}
