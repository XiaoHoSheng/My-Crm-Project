using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

/// <summary>
/// CustomerRepository：只负责“访问数据库”
/// - 这里放 SQL、Dapper 查询/执行
/// - Controller 不再直接写 SQL
///
/// ✅ 本版本增强：
/// - GET 列表 / GET 单个：都会 LEFT JOIN tb_customer_type，返回 CustomerTypeName
/// - keyword 搜索：匹配客户名/联系人/电话
/// - 分页：page 从 1 开始，pageSize 1~100
/// </summary>
public class CustomerRepository
{
    private readonly IConfiguration _config;

    public CustomerRepository(IConfiguration config)
    {
        _config = config;
    }

    /// <summary>
    /// 创建一个新的数据库连接
    /// 连接串读取自 appsettings.json -> ConnectionStrings -> CrmDb
    /// </summary>
    private MySqlConnection NewConn()
    {
        var cs = _config.GetConnectionString("CrmDb");
        if (string.IsNullOrWhiteSpace(cs))
            throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");

        // ✅ 打印关键信息：不打印密码（只打印长度）
        var csb = new MySqlConnectionStringBuilder(cs);
        Console.WriteLine(
            $"[CrmDb] Server={csb.Server}; Port={csb.Port}; Database={csb.Database}; User={csb.UserID}; PasswordLength={(csb.Password?.Length ?? 0)}"
        );

        return new MySqlConnection(cs);
    }

    // =========================
    // 1) 查询：列表 + 分页 + keyword 模糊搜索（带 CustomerTypeName）
    // =========================
    public async Task<(int total, List<CustomerDto> items)> GetPagedAsync(string? keyword, int page, int pageSize)
    {
        // ---------- 参数兜底 ----------
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        // keyword -> "%张%"，用于 LIKE
        var kw = string.IsNullOrWhiteSpace(keyword) ? null : $"%{keyword.Trim()}%";

        // ✅ 注意：这里要用表别名 c.（因为我们 JOIN 了 t）
        const string where = @"
WHERE (@kw IS NULL)
   OR c.name LIKE @kw
   OR c.contact_person LIKE @kw
   OR c.phone LIKE @kw
";

        // ---------- count：总数 ----------
        var countSql = @"
SELECT COUNT(*)
FROM tb_customer_information c
LEFT JOIN tb_customer_type t ON c.customer_type_id = t.type_id
" + where + ";";

        // ---------- list：当前页数据 ----------
        // ✅ t.name AS CustomerTypeName => 映射到 CustomerDto.CustomerTypeName
        var listSql = @"
SELECT
  c.id AS Id,
  c.customer_id AS CustomerId,
  c.grade AS Grade,
  c.name AS Name,
  c.registration_time AS RegistrationTime,
  c.contact_person AS ContactPerson,
  c.phone AS Phone,
  c.email AS Email,
  c.address AS Address,
  c.customer_type_id AS CustomerTypeId,
  t.name AS CustomerTypeName
FROM tb_customer_information c
LEFT JOIN tb_customer_type t ON c.customer_type_id = t.type_id
" + where + @"
ORDER BY c.id DESC
LIMIT @pageSize OFFSET @offset;
";

        await using var conn = NewConn();
        await conn.OpenAsync();

        var total = await conn.ExecuteScalarAsync<int>(countSql, new { kw });
        var items = (await conn.QueryAsync<CustomerDto>(listSql, new { kw, pageSize, offset })).ToList();

        return (total, items);
    }

    // =========================
    // 2) 查询：根据主键 id 查单个（带 CustomerTypeName）
    // =========================
    public async Task<CustomerDto?> GetByIdAsync(int id)
    {
        const string sql = @"
SELECT
  c.id AS Id,
  c.customer_id AS CustomerId,
  c.grade AS Grade,
  c.name AS Name,
  c.registration_time AS RegistrationTime,
  c.contact_person AS ContactPerson,
  c.phone AS Phone,
  c.email AS Email,
  c.address AS Address,
  c.customer_type_id AS CustomerTypeId,
  t.name AS CustomerTypeName
FROM tb_customer_information c
LEFT JOIN tb_customer_type t ON c.customer_type_id = t.type_id
WHERE c.id = @id;
";

        await using var conn = NewConn();
        await conn.OpenAsync();

        return await conn.QueryFirstOrDefaultAsync<CustomerDto>(sql, new { id });
    }

    // =========================
    // 3) 新增：返回新插入的自增 id
    // =========================
    public async Task<int> CreateAsync(CustomerDto dto)
    {
        // ✅ 这里只插入客户表本身字段（CustomerTypeName 不需要插入）
        const string sql = @"
INSERT INTO tb_customer_information
(customer_id, grade, name, registration_time, contact_person, phone, email, address, customer_type_id)
VALUES
(@CustomerId, @Grade, @Name, @RegistrationTime, @ContactPerson, @Phone, @Email, @Address, @CustomerTypeId);
SELECT LAST_INSERT_ID();
";

        await using var conn = NewConn();
        await conn.OpenAsync();

        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }

    // =========================
    // 4) 更新：返回是否更新成功（true=更新到一行，false=目标不存在）
    // =========================
    public async Task<bool> UpdateAsync(int id, CustomerDto dto)
    {
        const string sql = @"
UPDATE tb_customer_information
SET
  customer_id = @CustomerId,
  grade = @Grade,
  name = @Name,
  registration_time = @RegistrationTime,
  contact_person = @ContactPerson,
  phone = @Phone,
  email = @Email,
  address = @Address,
  customer_type_id = @CustomerTypeId
WHERE id = @id;
";

        await using var conn = NewConn();
        await conn.OpenAsync();

        // ✅ 用匿名对象把 dto 里的字段展开（清晰、好调试）
        var rows = await conn.ExecuteAsync(sql, new
        {
            id,
            dto.CustomerId,
            dto.Grade,
            dto.Name,
            dto.RegistrationTime,
            dto.ContactPerson,
            dto.Phone,
            dto.Email,
            dto.Address,
            dto.CustomerTypeId
        });

        return rows > 0;
    }

    // =========================
    // 5) 删除：返回是否删除成功（true=删到一行，false=目标不存在）
    // =========================
    public async Task<bool> DeleteAsync(int id)
    {
        const string sql = @"DELETE FROM tb_customer_information WHERE id = @id;";

        await using var conn = NewConn();
        await conn.OpenAsync();

        var rows = await conn.ExecuteAsync(sql, new { id });
        return rows > 0;
    }
}
