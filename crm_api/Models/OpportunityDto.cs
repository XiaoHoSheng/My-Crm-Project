namespace crm_api.Models;

public class OpportunityDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string Stage { get; set; } = "New"; 
    public DateTime? ClosingDate { get; set; }
    public string? Description { get; set; }
    public int? CustomerId { get; set; }
    
    // 附加信息：客户名字（用于前端显示）
    public string? CustomerName { get; set; }
}

public class CreateOpportunityDto
{
    public string Name { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string Stage { get; set; } = "New";
    public DateTime? ClosingDate { get; set; }
    public string? Description { get; set; }
    public int? CustomerId { get; set; }
}