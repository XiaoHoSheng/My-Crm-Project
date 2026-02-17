using Dapper;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

using crm_api.Dtos.Tasks;
using crm_api.Models;

namespace crm_api.Controllers;


[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public TasksController(IConfiguration configuration)
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
    // GET /api/Tasks?keyword=&page=1&pageSize=10
    // =========================
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<TaskDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<TaskDto>>> GetList(
        [FromQuery] string? keyword = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 10 : pageSize;
        pageSize = pageSize > 200 ? 200 : pageSize;

        var kw = (keyword ?? "").Trim();
        var where = string.IsNullOrEmpty(kw)
            ? ""
            : "WHERE title LIKE CONCAT('%', @kw, '%')";

        var offset = (page - 1) * pageSize;

        var sqlCount = $@"SELECT COUNT(1) FROM tb_task {where};";

        var sqlList = $@"
SELECT
  id AS Id,
  title AS Title,
  status AS Status,
  assigned_to AS AssignedTo,
  due_date AS DueDate,
  created_at AS CreatedAt,
  updated_at AS UpdatedAt
FROM tb_task
{where}
ORDER BY updated_at DESC, id DESC
LIMIT @pageSize OFFSET @offset;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var total = await conn.ExecuteScalarAsync<int>(sqlCount, new { kw });
        var items = (await conn.QueryAsync<TaskDto>(sqlList, new { kw, pageSize, offset })).ToList();

        return Ok(new crm_api.Models.PagedResult<TaskDto> { Total = total, Items = items });

        //return Ok(new PagedResult<TaskDto> { Total = total, Items = items });
    }

    // =========================
    // POST /api/Tasks
    // =========================
    [HttpPost]
    [ProducesResponseType(typeof(TaskDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<TaskDto>> Create([FromBody] TaskCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");

        const string sqlInsert = @"
INSERT INTO tb_task (title, status, assigned_to, due_date)
VALUES (@Title, @Status, @AssignedTo, @DueDate);
SELECT LAST_INSERT_ID();
";

        const string sqlGet = @"
SELECT
  id AS Id,
  title AS Title,
  status AS Status,
  assigned_to AS AssignedTo,
  due_date AS DueDate,
  created_at AS CreatedAt,
  updated_at AS UpdatedAt
FROM tb_task
WHERE id = @id;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var id = await conn.ExecuteScalarAsync<long>(sqlInsert, new
        {
            Title = dto.Title.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending" : dto.Status.Trim(),
            AssignedTo = string.IsNullOrWhiteSpace(dto.AssignedTo) ? null : dto.AssignedTo.Trim(),
            dto.DueDate
        });

        var created = await conn.QuerySingleAsync<TaskDto>(sqlGet, new { id });
        return Ok(created);
    }

    // =========================
    // PUT /api/Tasks/{id}
    // =========================
    [HttpPut("{id:long}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update([FromRoute] long id, [FromBody] TaskUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");

        const string sql = @"
UPDATE tb_task
SET
  title = @Title,
  status = @Status,
  assigned_to = @AssignedTo,
  due_date = @DueDate
WHERE id = @id;
";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new
        {
            id,
            Title = dto.Title.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending" : dto.Status.Trim(),
            AssignedTo = string.IsNullOrWhiteSpace(dto.AssignedTo) ? null : dto.AssignedTo.Trim(),
            dto.DueDate
        });

        if (affected == 0) return NotFound();
        return Ok();
    }

    // =========================
    // DELETE /api/Tasks/{id}
    // =========================
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete([FromRoute] long id)
    {
        const string sql = @"DELETE FROM tb_task WHERE id = @id;";

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(sql, new { id });
        if (affected == 0) return NotFound();

        return Ok();
    }
}
