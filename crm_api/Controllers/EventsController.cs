using Dapper;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

using crm_api.Models;

namespace crm_api.Controllers;

[ApiController]
[Route("api")]
public class EventsController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public EventsController(IConfiguration configuration)
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

    // =========================
    // DTOs
    // =========================
    public class EventRecordDto
    {
        public int Id { get; set; }
        public int? EventId { get; set; }
        public int? CustomerId { get; set; }
        public DateTime? EventTime { get; set; }
        public string? EventCharacter { get; set; }
        public string? Staff { get; set; }
        public string? Theme { get; set; }
        public string? Content { get; set; }
    }

    // ✅ 全局 Activities 列表需要客户名
    public class GlobalEventRecordDto
    {
        public int Id { get; set; }
        public int? EventId { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public DateTime? EventTime { get; set; }
        public string? EventCharacter { get; set; }
        public string? Staff { get; set; }
        public string? Theme { get; set; }
        public string? Content { get; set; }
    }

    public class CreateEventRequest
    {
        public int? EventId { get; set; }
        public DateTime? EventTime { get; set; }
        public string? EventCharacter { get; set; }
        public string? Staff { get; set; }
        public string? Theme { get; set; }
        public string? Content { get; set; }
    }

    public class UpdateEventRequest
    {
        public DateTime? EventTime { get; set; }
        public string? EventCharacter { get; set; }
        public string? Staff { get; set; }
        public string? Theme { get; set; }
        public string? Content { get; set; }
    }

    // =========================
    // ✅ GET /api/events  （全局 Activities 列表）
    // =========================
    [HttpGet("events")]
    [ProducesResponseType(typeof(PagedResult<GlobalEventRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<GlobalEventRecordDto>>> GetEvents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? keyword = null,
        [FromQuery] int? customerId = null,
        [FromQuery] string? eventCharacter = null,
        [FromQuery] string? staff = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null
    )
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var offset = (page - 1) * pageSize;
        keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
        eventCharacter = string.IsNullOrWhiteSpace(eventCharacter) ? null : eventCharacter.Trim();
        staff = string.IsNullOrWhiteSpace(staff) ? null : staff.Trim();

        var p = new DynamicParameters();
        p.Add("@keyword", keyword);
        p.Add("@customerId", customerId);
        p.Add("@eventCharacter", eventCharacter);
        p.Add("@staff", staff);
        p.Add("@from", from);
        p.Add("@to", to);
        p.Add("@pageSize", pageSize);
        p.Add("@offset", offset);

        var where = @"
WHERE 1=1
  AND (@customerId IS NULL OR e.customer_id = @customerId)
  AND (@eventCharacter IS NULL OR e.event_character = @eventCharacter)
  AND (@staff IS NULL OR e.staff LIKE CONCAT('%', @staff, '%'))
  AND (@from IS NULL OR e.event_time >= @from)
  AND (@to IS NULL OR e.event_time <= @to)
  AND (
        @keyword IS NULL
        OR e.theme LIKE CONCAT('%', @keyword, '%')
        OR e.content LIKE CONCAT('%', @keyword, '%')
        OR e.event_character LIKE CONCAT('%', @keyword, '%')
        OR e.staff LIKE CONCAT('%', @keyword, '%')
        OR c.name LIKE CONCAT('%', @keyword, '%')
      )
";

        var countSql = @"
SELECT COUNT(1)
FROM tb_event_record e
LEFT JOIN tb_customer_information c ON e.customer_id = c.id
" + where + ";";

        var listSql = @"
SELECT
  e.id AS Id,
  e.event_id AS EventId,
  e.customer_id AS CustomerId,
  c.name AS CustomerName,
  e.event_time AS EventTime,
  e.event_character AS EventCharacter,
  e.staff AS Staff,
  e.theme AS Theme,
  e.content AS Content
FROM tb_event_record e
LEFT JOIN tb_customer_information c ON e.customer_id = c.id
" + where + @"
ORDER BY e.event_time DESC, e.id DESC
LIMIT @pageSize OFFSET @offset;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var total = await conn.ExecuteScalarAsync<int>(countSql, p);
        var items = (await conn.QueryAsync<GlobalEventRecordDto>(listSql, p)).ToList();

        return Ok(new PagedResult<GlobalEventRecordDto>(items, total));
    }

    // =========================
    // GET /api/customers/{customerId}/events
    // =========================
    [HttpGet("customers/{customerId:int}/events")]
    [ProducesResponseType(typeof(PagedResult<EventRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<EventRecordDto>>> GetCustomerEvents(
        int customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? keyword = null)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var offset = (page - 1) * pageSize;
        keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

        const string countSql = @"
SELECT COUNT(1)
FROM tb_event_record
WHERE customer_id = @customerId
  AND (
        @keyword IS NULL
        OR theme LIKE CONCAT('%', @keyword, '%')
        OR content LIKE CONCAT('%', @keyword, '%')
        OR event_character LIKE CONCAT('%', @keyword, '%')
        OR staff LIKE CONCAT('%', @keyword, '%')
      );
";

        const string listSql = @"
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
  AND (
        @keyword IS NULL
        OR theme LIKE CONCAT('%', @keyword, '%')
        OR content LIKE CONCAT('%', @keyword, '%')
        OR event_character LIKE CONCAT('%', @keyword, '%')
        OR staff LIKE CONCAT('%', @keyword, '%')
      )
ORDER BY event_time DESC, id DESC
LIMIT @pageSize OFFSET @offset;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var total = await conn.ExecuteScalarAsync<int>(countSql, new { customerId, keyword });
        var items = (await conn.QueryAsync<EventRecordDto>(listSql, new { customerId, keyword, pageSize, offset })).ToList();

        return Ok(new PagedResult<EventRecordDto>(items, total));
    }

    // =========================
    // POST /api/customers/{customerId}/events
    // =========================
    [HttpPost("customers/{customerId:int}/events")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<ActionResult<int>> CreateCustomerEvent(int customerId, [FromBody] CreateEventRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Theme) && string.IsNullOrWhiteSpace(req.Content))
            return BadRequest("Theme and Content cannot both be empty.");

        var eventTime = req.EventTime ?? DateTime.Now;

        const string sql = @"
INSERT INTO tb_event_record
  (event_id, customer_id, event_time, event_character, staff, theme, content)
VALUES
  (@EventId, @CustomerId, @EventTime, @EventCharacter, @Staff, @Theme, @Content);
SELECT LAST_INSERT_ID();
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var newId = await conn.ExecuteScalarAsync<int>(sql, new
        {
            EventId = req.EventId,
            CustomerId = customerId,
            EventTime = eventTime,
            EventCharacter = req.EventCharacter,
            Staff = req.Staff,
            Theme = req.Theme,
            Content = req.Content
        });

        return Ok(newId);
    }

    // =========================
    // PUT /api/events/{id}
    // =========================
    [HttpPut("events/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateEvent(int id, [FromBody] UpdateEventRequest req)
    {
        const string sql = @"
UPDATE tb_event_record
SET
  event_time = @EventTime,
  event_character = @EventCharacter,
  staff = @Staff,
  theme = @Theme,
  content = @Content
WHERE id = @Id;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new
        {
            Id = id,
            EventTime = req.EventTime,
            EventCharacter = req.EventCharacter,
            Staff = req.Staff,
            Theme = req.Theme,
            Content = req.Content
        });

        if (affected == 0) return NotFound();
        return NoContent();
    }

    // =========================
    // DELETE /api/events/{id}
    // =========================
    [HttpDelete("events/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteEvent(int id)
    {
        const string sql = @"DELETE FROM tb_event_record WHERE id = @Id;";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new { Id = id });
        if (affected == 0) return NotFound();

        return NoContent();
    }
}
