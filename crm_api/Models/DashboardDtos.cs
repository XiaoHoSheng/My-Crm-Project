namespace crm_api.Models;

public class DashboardStatsDto
{
    public int TotalCustomers { get; set; }
    public int ActiveOpportunities { get; set; }
    public decimal TotalForecastAmount { get; set; } // 预计总销售额
    public int WonDealsThisMonth { get; set; }
}

public class StageStatDto
{
    public string Stage { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalAmount { get; set; }
}

public class RecentDealDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public DateTime? CloseDate { get; set; }
}