using Microsoft.AspNetCore.Mvc;
using MySqlConnector;
using Dapper;

namespace crm_api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomerTypesController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public CustomerTypesController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private string GetConnStr()
    {
        var connStr = _configuration.GetConnectionString("CrmDb");
        if (string.IsNullOrWhiteSpace(connStr))
            throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
        return connStr;
    }

    public record CustomerTypeItem(int TypeId, string Name);

    [HttpGet]
    [ProducesResponseType(typeof(List<CustomerTypeItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CustomerTypeItem>>> Get()
    {
        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        const string sql = @"
SELECT type_id AS TypeId, name AS Name
FROM tb_customer_type
ORDER BY type_id;
";
        var rows = (await conn.QueryAsync<CustomerTypeItem>(sql)).ToList();
        return Ok(rows);
    }
}








