using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

public class OpportunityRepository
{
    private readonly IConfiguration _config;

    public OpportunityRepository(IConfiguration config)
    {
        _config = config;
    }

    private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

    // 1. 获取所有商机
    public async Task<IEnumerable<OpportunityDto>> GetAllAsync()
    {
        const string sql = @"
SELECT 
    o.id, o.name, o.amount, o.stage, o.closing_date AS ClosingDate, o.description, 
    o.customer_id AS CustomerId,
    c.name AS CustomerName
FROM tb_opportunities o
LEFT JOIN tb_customer_information c ON o.customer_id = c.id
ORDER BY o.id DESC;";

        await using var conn = NewConn();
        return await conn.QueryAsync<OpportunityDto>(sql);
    }

    // 2. ✅ 新增：根据 CustomerId 获取商机列表
    public async Task<IEnumerable<OpportunityDto>> GetByCustomerIdAsync(int customerId)
    {
        const string sql = @"
SELECT 
    o.id, o.name, o.amount, o.stage, o.closing_date AS ClosingDate, o.description, 
    o.customer_id AS CustomerId,
    c.name AS CustomerName
FROM tb_opportunities o
LEFT JOIN tb_customer_information c ON o.customer_id = c.id
WHERE o.customer_id = @customerId
ORDER BY o.id DESC;";

        await using var conn = NewConn();
        return await conn.QueryAsync<OpportunityDto>(sql, new { customerId });
    }

    // 3. 新增
    public async Task<int> CreateAsync(CreateOpportunityDto dto)
    {
        const string sql = @"
INSERT INTO tb_opportunities (name, amount, stage, closing_date, description, customer_id)
VALUES (@Name, @Amount, @Stage, @ClosingDate, @Description, @CustomerId);
SELECT LAST_INSERT_ID();";

        await using var conn = NewConn();
        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }

    // 4. 更新阶段
    public async Task<bool> UpdateStageAsync(int id, string newStage)
    {
        const string sql = "UPDATE tb_opportunities SET stage = @newStage WHERE id = @id";
        await using var conn = NewConn();
        return await conn.ExecuteAsync(sql, new { id, newStage }) > 0;
    }

    // 5. 完整更新
    public async Task<bool> UpdateAsync(int id, CreateOpportunityDto dto)
    {
        const string sql = @"
UPDATE tb_opportunities 
SET name=@Name, amount=@Amount, stage=@Stage, closing_date=@ClosingDate, description=@Description, customer_id=@CustomerId
WHERE id = @id";
        await using var conn = NewConn();
        return await conn.ExecuteAsync(sql, new { 
            id, dto.Name, dto.Amount, dto.Stage, dto.ClosingDate, dto.Description, dto.CustomerId 
        }) > 0;
    }

    // 6. 删除
    public async Task<bool> DeleteAsync(int id)
    {
        const string sql = "DELETE FROM tb_opportunities WHERE id = @id";
        await using var conn = NewConn();
        return await conn.ExecuteAsync(sql, new { id }) > 0;
    }
}




















// using Dapper;
// using MySqlConnector;
// using crm_api.Models;

// namespace crm_api.Repositories;

// public class OpportunityRepository
// {
//     private readonly IConfiguration _config;

//     public OpportunityRepository(IConfiguration config)
//     {
//         _config = config;
//     }

//     private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

//     // 1. 获取所有商机
//     public async Task<IEnumerable<OpportunityDto>> GetAllAsync()
//     {
//         const string sql = @"
// SELECT 
//     o.id, o.name, o.amount, o.stage, o.closing_date AS ClosingDate, o.description, 
//     o.customer_id AS CustomerId,
//     c.name AS CustomerName
// FROM tb_opportunities o
// LEFT JOIN tb_customer_information c ON o.customer_id = c.id
// ORDER BY o.id DESC;";

//         await using var conn = NewConn();
//         return await conn.QueryAsync<OpportunityDto>(sql);
//     }

//     // 2. 新增
//     public async Task<int> CreateAsync(CreateOpportunityDto dto)
//     {
//         const string sql = @"
// INSERT INTO tb_opportunities (name, amount, stage, closing_date, description, customer_id)
// VALUES (@Name, @Amount, @Stage, @ClosingDate, @Description, @CustomerId);
// SELECT LAST_INSERT_ID();";

//         await using var conn = NewConn();
//         return await conn.ExecuteScalarAsync<int>(sql, dto);
//     }

//     // 3. 更新阶段（拖拽时用）
//     public async Task<bool> UpdateStageAsync(int id, string newStage)
//     {
//         const string sql = "UPDATE tb_opportunities SET stage = @newStage WHERE id = @id";
//         await using var conn = NewConn();
//         return await conn.ExecuteAsync(sql, new { id, newStage }) > 0;
//     }

//     // 4. 完整更新
//     public async Task<bool> UpdateAsync(int id, CreateOpportunityDto dto)
//     {
//         const string sql = @"
// UPDATE tb_opportunities 
// SET name=@Name, amount=@Amount, stage=@Stage, closing_date=@ClosingDate, description=@Description, customer_id=@CustomerId
// WHERE id = @id";
//         await using var conn = NewConn();
//         return await conn.ExecuteAsync(sql, new { 
//             id, dto.Name, dto.Amount, dto.Stage, dto.ClosingDate, dto.Description, dto.CustomerId 
//         }) > 0;
//     }

//     // 5. 删除
//     public async Task<bool> DeleteAsync(int id)
//     {
//         const string sql = "DELETE FROM tb_opportunities WHERE id = @id";
//         await using var conn = NewConn();
//         return await conn.ExecuteAsync(sql, new { id }) > 0;
//     }


//     // ... 原有的代码 ...

//     // ✅ 新增：根据 CustomerId 获取商机列表
//     public async Task<IEnumerable<OpportunityDto>> GetByCustomerIdAsync(int customerId)
//     {
//         const string sql = @"
// SELECT 
//     o.id, o.name, o.amount, o.stage, o.closing_date AS ClosingDate, o.description, 
//     o.customer_id AS CustomerId,
//     c.name AS CustomerName
// FROM tb_opportunities o
// LEFT JOIN tb_customer_information c ON o.customer_id = c.id
// WHERE o.customer_id = @customerId
// ORDER BY o.id DESC;";

//         await using var conn = NewConn();
//         return await conn.QueryAsync<OpportunityDto>(sql, new { customerId });
//     }
// }