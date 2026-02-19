using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

public class EventRecordRepository
{
    private readonly IConfiguration _config;

    public EventRecordRepository(IConfiguration config)
    {
        _config = config;
    }

    private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

    public async Task<IEnumerable<EventRecordDto>> GetByCustomerIdAsync(int customerId)
    {
        const string sql = @"
            SELECT 
                id AS Id, 
                event_id AS EventId,
                customer_id AS CustomerId, 
                event_time AS EventTime, 
                event_character AS EventCharacter, 
                staff AS Staff,
                theme AS Theme,
                content AS Content
            FROM tb_event_record 
            WHERE customer_id = @customerId 
            ORDER BY event_time DESC;";
            
        await using var conn = NewConn();
        return await conn.QueryAsync<EventRecordDto>(sql, new { customerId });
    }

    public async Task<int> CreateAsync(EventRecordDto dto)
    {
        const string sql = @"
            INSERT INTO tb_event_record 
            (event_id, customer_id, event_time, event_character, staff, theme, content) 
            VALUES 
            (@EventId, @CustomerId, @EventTime, @EventCharacter, @Staff, @Theme, @Content);
            SELECT LAST_INSERT_ID();";
            
        await using var conn = NewConn();
        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }
}