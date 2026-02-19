using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

public class CustomerNoteRepository
{
    private readonly IConfiguration _config;

    public CustomerNoteRepository(IConfiguration config)
    {
        _config = config;
    }

    private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

    // 获取某个客户的所有备注 (按时间倒序)
    public async Task<IEnumerable<CustomerNoteDto>> GetByCustomerIdAsync(int customerId)
    {
        const string sql = @"
            SELECT 
                id AS Id, 
                customer_id AS CustomerId, 
                content AS Content, 
                created_at AS CreatedAt 
            FROM tb_customer_note 
            WHERE customer_id = @customerId 
            ORDER BY created_at DESC;";
            
        await using var conn = NewConn();
        return await conn.QueryAsync<CustomerNoteDto>(sql, new { customerId });
    }

    // 新增一条客户备注
    public async Task<int> CreateAsync(CustomerNoteDto dto)
    {
        const string sql = @"
            INSERT INTO tb_customer_note (customer_id, content, created_at) 
            VALUES (@CustomerId, @Content, @CreatedAt);
            SELECT LAST_INSERT_ID();";
            
        await using var conn = NewConn();
        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }
}