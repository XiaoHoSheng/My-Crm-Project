using Dapper;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Repositories;

public class UserRepository
{
    private readonly IConfiguration _config;

    public UserRepository(IConfiguration config)
    {
        _config = config;
    }

    private MySqlConnection NewConn() => new MySqlConnection(_config.GetConnectionString("CrmDb"));

    // 根据用户名查找用户
    public async Task<UserDto?> GetByUsernameAsync(string username)
    {
        // ⚠️ 这里的字段名 username, password 请根据你数据库 tb_user_information 的实际字段修改
        const string sql = "SELECT id AS Id, username AS Username, password AS Password FROM tb_user_information WHERE username = @username LIMIT 1;";
        await using var conn = NewConn();
        return await conn.QueryFirstOrDefaultAsync<UserDto>(sql, new { username });
    }
}