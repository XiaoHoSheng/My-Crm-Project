using Dapper;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

namespace crm_api.Controllers;

[ApiController]
[Route("api/customers/{customerId:int}/notes")]
public class CustomerNotesController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public CustomerNotesController(IConfiguration configuration)
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

    public record NoteDto(long Id, int CustomerId, string Content, DateTime CreatedAt);
    public record CreateNoteRequest(string Content);

    // GET /api/customers/{customerId}/notes
    [HttpGet]
    public async Task<ActionResult<List<NoteDto>>> GetNotes(int customerId)
    {
        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        const string sql = @"
SELECT id AS Id,
       customer_id AS CustomerId,
       content AS Content,
       created_at AS CreatedAt
FROM tb_customer_note
WHERE customer_id = @customerId
ORDER BY created_at DESC, id DESC;
";
        var list = (await conn.QueryAsync<NoteDto>(sql, new { customerId })).ToList();
        return Ok(list);
    }

    // POST /api/customers/{customerId}/notes
    [HttpPost]
    public async Task<ActionResult<NoteDto>> CreateNote(int customerId, [FromBody] CreateNoteRequest req)
    {
        var content = (req?.Content ?? "").Trim();
        if (string.IsNullOrWhiteSpace(content))
            return BadRequest("content is required");

        if (content.Length > 1000)
            return BadRequest("content is too long (max 1000)");

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        const string insertSql = @"
INSERT INTO tb_customer_note (customer_id, content)
VALUES (@customerId, @content);
SELECT LAST_INSERT_ID();
";
        var newId = await conn.ExecuteScalarAsync<long>(insertSql, new { customerId, content });

        const string querySql = @"
SELECT id AS Id,
       customer_id AS CustomerId,
       content AS Content,
       created_at AS CreatedAt
FROM tb_customer_note
WHERE id = @id;
";
        var created = await conn.QuerySingleAsync<NoteDto>(querySql, new { id = newId });

        return Ok(created);
    }

    // DELETE /api/customers/{customerId}/notes/{noteId}
    [HttpDelete("{noteId:long}")]
    public async Task<IActionResult> DeleteNote(int customerId, long noteId)
    {
        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        const string sql = @"
DELETE FROM tb_customer_note
WHERE id = @noteId AND customer_id = @customerId;
";
        var rows = await conn.ExecuteAsync(sql, new { noteId, customerId });

        if (rows == 0) return NotFound();
        return NoContent();
    }
}
