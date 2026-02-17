using Microsoft.AspNetCore.Mvc;
using MySqlConnector;
using Dapper;

namespace crm_api.Controllers;

public record ContactDto(
    long Id,
    long? CustomerId,
    string Name,
    string? Title,
    string? Phone,
    string? Email,
    string? Wechat,
    bool IsPrimary,
    string? Tags,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record ContactCreateUpdateDto(
    long? CustomerId,
    string Name,
    string? Title,
    string? Phone,
    string? Email,
    string? Wechat,
    bool IsPrimary,
    string? Tags,
    string? Notes
);

public record PagedResult<T>(IReadOnlyList<T> Items, long Total);

[ApiController]
[Route("api/[controller]")]
public class ContactsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    public ContactsController(IConfiguration configuration) => _configuration = configuration;

    private string GetConnStr()
    {
        var connStr = _configuration.GetConnectionString("CrmDb");
        if (string.IsNullOrWhiteSpace(connStr))
            throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
        return connStr;
    }

    // =========================
    // GET /api/contacts?keyword=&page=1&pageSize=10&customerId=
    // =========================
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ContactDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ContactDto>>> GetContacts(
        [FromQuery] string? keyword,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] long? customerId = null
    )
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 200 ? 10 : pageSize;

        var where = "WHERE 1=1 ";
        var p = new DynamicParameters();

        if (customerId.HasValue)
        {
            where += " AND customer_id = @CustomerId ";
            p.Add("@CustomerId", customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            where += " AND (name LIKE @Kw OR phone LIKE @Kw OR email LIKE @Kw OR wechat LIKE @Kw) ";
            p.Add("@Kw", $"%{keyword.Trim()}%");
        }

        var offset = (page - 1) * pageSize;
        p.Add("@Offset", offset);
        p.Add("@PageSize", pageSize);

        var sqlTotal = $@"SELECT COUNT(1) FROM tb_contacts {where};";

        var sqlItems = $@"
SELECT
  id AS Id,
  customer_id AS CustomerId,
  name AS Name,
  title AS Title,
  phone AS Phone,
  email AS Email,
  wechat AS Wechat,
  is_primary AS IsPrimary,
  tags AS Tags,
  notes AS Notes,
  created_at AS CreatedAt,
  updated_at AS UpdatedAt
FROM tb_contacts
{where}
ORDER BY updated_at DESC
LIMIT @Offset, @PageSize;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var total = await conn.ExecuteScalarAsync<long>(sqlTotal, p);
        var items = (await conn.QueryAsync<ContactDto>(sqlItems, p)).ToList();

        return Ok(new PagedResult<ContactDto>(items, total));
    }

    // =========================
    // POST /api/contacts
    // =========================
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateContact([FromBody] ContactCreateUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Name is required.");

        const string sql = @"
INSERT INTO tb_contacts
(customer_id, name, title, phone, email, wechat, is_primary, tags, notes)
VALUES
(@CustomerId, @Name, @Title, @Phone, @Email, @Wechat, @IsPrimary, @Tags, @Notes);
SELECT LAST_INSERT_ID();
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var newId = await conn.ExecuteScalarAsync<long>(sql, new
        {
            dto.CustomerId,
            Name = dto.Name.Trim(),
            dto.Title,
            dto.Phone,
            dto.Email,
            dto.Wechat,
            IsPrimary = dto.IsPrimary ? 1 : 0,
            dto.Tags,
            dto.Notes
        });

        return Created($"/api/contacts/{newId}", new { id = newId });
    }

    // =========================
    // PUT /api/contacts/{id}
    // =========================
    [HttpPut("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateContact([FromRoute] long id, [FromBody] ContactCreateUpdateDto dto)
    {
        if (id <= 0) return BadRequest("Invalid id.");
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Name is required.");

        const string sql = @"
UPDATE tb_contacts
SET
  customer_id = @CustomerId,
  name = @Name,
  title = @Title,
  phone = @Phone,
  email = @Email,
  wechat = @Wechat,
  is_primary = @IsPrimary,
  tags = @Tags,
  notes = @Notes
WHERE id = @Id;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new
        {
            Id = id,
            dto.CustomerId,
            Name = dto.Name.Trim(),
            dto.Title,
            dto.Phone,
            dto.Email,
            dto.Wechat,
            IsPrimary = dto.IsPrimary ? 1 : 0,
            dto.Tags,
            dto.Notes
        });

        if (affected == 0) return NotFound();
        return NoContent();
    }

    // =========================
    // DELETE /api/contacts/{id}
    // =========================
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteContact([FromRoute] long id)
    {
        if (id <= 0) return BadRequest("Invalid id.");

        const string sql = @"DELETE FROM tb_contacts WHERE id = @Id;";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new { Id = id });
        if (affected == 0) return NotFound();
        return NoContent();
    }
}
