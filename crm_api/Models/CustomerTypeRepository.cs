using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

/// <summary>
/// CustomerTypeRepository：只负责“访问数据库”
/// Controller 调用它来做 CRUD
/// </summary>
public class CustomerTypeRepository
{
    private readonly IConfiguration _config;

    public CustomerTypeRepository(IConfiguration config)
    {
        _config = config;
    }

    /// <summary>
    /// 每次操作数据库都新建一个连接，用完就释放
    /// </summary>
    private MySqlConnection NewConn()
    {
        var cs = _config.GetConnectionString("CrmDb");
        if (string.IsNullOrWhiteSpace(cs))
            throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");

        return new MySqlConnection(cs);
    }

    /// <summary>查询全部客户类型</summary>
    public async Task<List<CustomerTypeDto>> GetAllAsync()
    {
        const string sql = @"
SELECT
  id AS Id,
  type_id AS TypeId,
  name AS Name
FROM tb_customer_type
ORDER BY id DESC;
";
        await using var conn = NewConn();
        return (await conn.QueryAsync<CustomerTypeDto>(sql)).ToList();
    }

    /// <summary>按主键 id 查询单条</summary>
    public async Task<CustomerTypeDto?> GetByIdAsync(int id)
    {
        const string sql = @"
SELECT
  id AS Id,
  type_id AS TypeId,
  name AS Name
FROM tb_customer_type
WHERE id = @id;
";
        await using var conn = NewConn();
        return await conn.QueryFirstOrDefaultAsync<CustomerTypeDto>(sql, new { id });
    }

    /// <summary>新增，返回新行的 id</summary>
    public async Task<int> CreateAsync(CreateCustomerTypeDto dto)
    {
        const string sql = @"
INSERT INTO tb_customer_type (type_id, name)
VALUES (@TypeId, @Name);
SELECT LAST_INSERT_ID();
";
        await using var conn = NewConn();
        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }

    /// <summary>更新（按 id），返回是否更新成功</summary>
    public async Task<bool> UpdateAsync(int id, UpdateCustomerTypeDto dto)
    {
        const string sql = @"
UPDATE tb_customer_type
SET type_id = @TypeId,
    name = @Name
WHERE id = @id;
";
        await using var conn = NewConn();
        var rows = await conn.ExecuteAsync(sql, new { id, dto.TypeId, dto.Name });
        return rows > 0;
    }

    /// <summary>删除（按 id），返回是否删除成功</summary>
    public async Task<bool> DeleteAsync(int id)
    {
        const string sql = @"DELETE FROM tb_customer_type WHERE id = @id;";
        await using var conn = NewConn();
        var rows = await conn.ExecuteAsync(sql, new { id });
        return rows > 0;
    }
}
