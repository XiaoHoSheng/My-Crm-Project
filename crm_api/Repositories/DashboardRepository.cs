using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

public class DashboardRepository
{
    private readonly IConfiguration _config;

    public DashboardRepository(IConfiguration config)
    {
        _config = config;
    }

    private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

    // 1. 获取顶部 KPI 统计
    public async Task<DashboardStatsDto> GetStatsAsync()
    {
        await using var conn = NewConn();
        
        // 这里的 SQL 同时查 4 个数字，非常高效
        const string sql = @"
            SELECT 
                (SELECT COUNT(*) FROM tb_customer_information) AS TotalCustomers,
                (SELECT COUNT(*) FROM tb_opportunities WHERE stage NOT IN ('Won', 'Lost')) AS ActiveOpportunities,
                (SELECT IFNULL(SUM(amount), 0) FROM tb_opportunities WHERE stage NOT IN ('Won', 'Lost')) AS TotalForecastAmount,
                (SELECT COUNT(*) FROM tb_opportunities WHERE stage = 'Won' AND MONTH(closing_date) = MONTH(CURRENT_DATE())) AS WonDealsThisMonth;
        ";

        return await conn.QuerySingleAsync<DashboardStatsDto>(sql);
    }

    // 2. 获取每个阶段的统计（用于画图）
    public async Task<IEnumerable<StageStatDto>> GetStageStatsAsync()
    {
        await using var conn = NewConn();
        const string sql = @"
            SELECT stage AS Stage, COUNT(*) AS Count, IFNULL(SUM(amount), 0) AS TotalAmount
            FROM tb_opportunities
            GROUP BY stage
            ORDER BY FIELD(stage, 'New', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost');
        ";
        return await conn.QueryAsync<StageStatDto>(sql);
    }

    // 3. 获取最近 5 个成交的单子
    public async Task<IEnumerable<RecentDealDto>> GetRecentWonDealsAsync()
    {
        await using var conn = NewConn();
        const string sql = @"
            SELECT o.id, o.name, o.amount, o.closing_date AS CloseDate, c.name AS CustomerName
            FROM tb_opportunities o
            LEFT JOIN tb_customer_information c ON o.customer_id = c.id
            WHERE o.stage = 'Won'
            ORDER BY o.closing_date DESC
            LIMIT 5;
        ";
        return await conn.QueryAsync<RecentDealDto>(sql);
    }
}