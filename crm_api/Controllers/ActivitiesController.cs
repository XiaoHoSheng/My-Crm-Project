using Dapper;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

using crm_api.Models;

namespace crm_api.Controllers;

/// <summary>
/// Activities（Salesforce 风格时间线）
/// - 合并 tb_event_record（Events） + tb_customer_note（Notes）
/// - 支持分页 / 关键字 / 时间范围 / 客户筛选 / 来源筛选
/// </summary>
[ApiController]
[Route("api")]
public class ActivitiesController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ActivitiesController(IConfiguration configuration)
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

    /// <summary>
    /// 统一活动流条目（Events + Notes）
    /// </summary>
    public class ActivityItemDto
    {
        /// <summary>来源：event / note</summary>
        public string Source { get; set; } = "";

        /// <summary>来源表的主键 ID</summary>
        public long Id { get; set; }

        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }

        /// <summary>排序时间：Event=event_time，Note=created_at（可能为 NULL，排序时会把 NULL 放在最后）</summary>
        public DateTime? Time { get; set; }

        /// <summary>类型：Event=event_character，Note固定为 NOTE</summary>
        public string? Type { get; set; }

        /// <summary>仅 Events 有</summary>
        public string? Staff { get; set; }

        /// <summary>标题：Event=theme，Note固定为 备注</summary>
        public string? Subject { get; set; }

        /// <summary>正文：Event=content，Note=content</summary>
        public string? Content { get; set; }
    }

    /// <summary>
    /// GET /api/activities
    /// - source: all | events | notes
    /// - customerId: 可选，传了就只看该客户
    /// - keyword: 模糊搜索（客户名/主题/内容/人员/类型）
    /// - from/to: 时间范围（包含）
    /// - eventCharacter: 仅对 events 生效
    /// </summary>
    [HttpGet("activities")]
    [ProducesResponseType(typeof(PagedResult<ActivityItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ActivityItemDto>>> GetActivities(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? source = "all",
        [FromQuery] int? customerId = null,
        [FromQuery] string? keyword = null,
        [FromQuery] string? staff = null,
        [FromQuery] string? eventCharacter = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var result = await QueryActivities(page, pageSize, source, customerId, keyword, staff, eventCharacter, from, to);
        return Ok(result);
    }

    /// <summary>
    /// GET /api/customers/{customerId}/activities
    /// 便于前端客户详情页直接调用（等价于 /api/activities?customerId=...）
    /// </summary>
    [HttpGet("customers/{customerId:int}/activities")]
    [ProducesResponseType(typeof(PagedResult<ActivityItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ActivityItemDto>>> GetCustomerActivities(
        int customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? source = "all",
        [FromQuery] string? keyword = null,
        [FromQuery] string? staff = null,
        [FromQuery] string? eventCharacter = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var result = await QueryActivities(page, pageSize, source, customerId, keyword, staff, eventCharacter, from, to);
        return Ok(result);
    }

    private async Task<PagedResult<ActivityItemDto>> QueryActivities(
        int page,
        int pageSize,
        string? source,
        int? customerId,
        string? keyword,
        string? staff,
        string? eventCharacter,
        DateTime? from,
        DateTime? to)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var offset = (page - 1) * pageSize;
        var src = (source ?? "all").Trim().ToLowerInvariant();
        if (src is not ("all" or "events" or "notes")) src = "all";

        keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
        staff = string.IsNullOrWhiteSpace(staff) ? null : staff.Trim();
        eventCharacter = string.IsNullOrWhiteSpace(eventCharacter) ? null : eventCharacter.Trim();

        var p = new DynamicParameters();
        p.Add("@customerId", customerId);
        p.Add("@keyword", keyword);
        p.Add("@staff", staff);
        p.Add("@eventCharacter", eventCharacter);
        p.Add("@from", from);
        p.Add("@to", to);
        p.Add("@pageSize", pageSize);
        p.Add("@offset", offset);

        // -------------------------
        // Events only
        // -------------------------
        if (src == "events")
        {
            var where = @"
WHERE 1=1
  AND (@customerId IS NULL OR e.customer_id = @customerId)
  AND (@eventCharacter IS NULL OR e.event_character = @eventCharacter)
  AND (@staff IS NULL OR e.staff LIKE CONCAT('%', @staff, '%'))
  AND (@from IS NULL OR e.event_time >= @from)
  AND (@to IS NULL OR e.event_time <= @to)
  AND (
        @keyword IS NULL
        OR c.name LIKE CONCAT('%', @keyword, '%')
        OR e.theme LIKE CONCAT('%', @keyword, '%')
        OR e.content LIKE CONCAT('%', @keyword, '%')
        OR e.staff LIKE CONCAT('%', @keyword, '%')
        OR e.event_character LIKE CONCAT('%', @keyword, '%')
      )
";

            var countSql = @"
SELECT COUNT(1)
FROM tb_event_record e
LEFT JOIN tb_customer_information c ON e.customer_id = c.id
" + where + ";";

            var listSql = @"
SELECT
  'event' AS Source,
  CAST(e.id AS SIGNED) AS Id,
  e.customer_id AS CustomerId,
  c.name AS CustomerName,
  e.event_time AS Time,
  e.event_character AS Type,
  e.staff AS Staff,
  e.theme AS Subject,
  e.content AS Content
FROM tb_event_record e
LEFT JOIN tb_customer_information c ON e.customer_id = c.id
" + where + @"
ORDER BY (e.event_time IS NULL) ASC, e.event_time DESC, e.id DESC
LIMIT @pageSize OFFSET @offset;
";

            await using var conn = new MySqlConnection(GetConnStr());
            await conn.OpenAsync();

            var total = await conn.ExecuteScalarAsync<int>(countSql, p);
            var items = (await conn.QueryAsync<ActivityItemDto>(listSql, p)).ToList();
            return new PagedResult<ActivityItemDto>(items, total);
        }

        // -------------------------
        // Notes only
        // -------------------------
        if (src == "notes")
        {
            var where = @"
WHERE 1=1
  AND (@customerId IS NULL OR n.customer_id = @customerId)
  AND (@from IS NULL OR n.created_at >= @from)
  AND (@to IS NULL OR n.created_at <= @to)
  AND (
        @keyword IS NULL
        OR c.name LIKE CONCAT('%', @keyword, '%')
        OR n.content LIKE CONCAT('%', @keyword, '%')
      )
";

            var countSql = @"
SELECT COUNT(1)
FROM tb_customer_note n
LEFT JOIN tb_customer_information c ON n.customer_id = c.id
" + where + ";";

            var listSql = @"
SELECT
  'note' AS Source,
  CAST(n.id AS SIGNED) AS Id,
  n.customer_id AS CustomerId,
  c.name AS CustomerName,
  n.created_at AS Time,
  'NOTE' AS Type,
  NULL AS Staff,
  '备注' AS Subject,
  n.content AS Content
FROM tb_customer_note n
LEFT JOIN tb_customer_information c ON n.customer_id = c.id
" + where + @"
ORDER BY (n.created_at IS NULL) ASC, n.created_at DESC, n.id DESC
LIMIT @pageSize OFFSET @offset;
";

            await using var conn = new MySqlConnection(GetConnStr());
            await conn.OpenAsync();

            var total = await conn.ExecuteScalarAsync<int>(countSql, p);
            var items = (await conn.QueryAsync<ActivityItemDto>(listSql, p)).ToList();
            return new PagedResult<ActivityItemDto>(items, total);
        }

        // -------------------------
        // All (Events + Notes)
        // -------------------------
        // 说明：eventCharacter / staff 只对 Events 生效
        // Notes 只参与 customerId/keyword/from/to 的过滤
        var countAllSql = @"
SELECT COUNT(1)
FROM (
  SELECT
    'event' AS Source,
    CAST(e.id AS SIGNED) AS Id,
    e.customer_id AS CustomerId,
    c.name AS CustomerName,
    e.event_time AS Time,
    e.event_character AS Type,
    e.staff AS Staff,
    e.theme AS Subject,
    e.content AS Content
  FROM tb_event_record e
  LEFT JOIN tb_customer_information c ON e.customer_id = c.id
  WHERE 1=1
    AND (@customerId IS NULL OR e.customer_id = @customerId)
    AND (@eventCharacter IS NULL OR e.event_character = @eventCharacter)
    AND (@staff IS NULL OR e.staff LIKE CONCAT('%', @staff, '%'))
    AND (@from IS NULL OR e.event_time >= @from)
    AND (@to IS NULL OR e.event_time <= @to)
    AND (
          @keyword IS NULL
          OR c.name LIKE CONCAT('%', @keyword, '%')
          OR e.theme LIKE CONCAT('%', @keyword, '%')
          OR e.content LIKE CONCAT('%', @keyword, '%')
          OR e.staff LIKE CONCAT('%', @keyword, '%')
          OR e.event_character LIKE CONCAT('%', @keyword, '%')
        )

  UNION ALL

  SELECT
    'note' AS Source,
    CAST(n.id AS SIGNED) AS Id,
    n.customer_id AS CustomerId,
    c2.name AS CustomerName,
    n.created_at AS Time,
    'NOTE' AS Type,
    NULL AS Staff,
    '备注' AS Subject,
    n.content AS Content
  FROM tb_customer_note n
  LEFT JOIN tb_customer_information c2 ON n.customer_id = c2.id
  WHERE 1=1
    AND (@customerId IS NULL OR n.customer_id = @customerId)
    AND (@from IS NULL OR n.created_at >= @from)
    AND (@to IS NULL OR n.created_at <= @to)
    AND (
          @keyword IS NULL
          OR c2.name LIKE CONCAT('%', @keyword, '%')
          OR n.content LIKE CONCAT('%', @keyword, '%')
        )
) t;
";

        var listAllSql = @"
SELECT *
FROM (
  SELECT
    'event' AS Source,
    CAST(e.id AS SIGNED) AS Id,
    e.customer_id AS CustomerId,
    c.name AS CustomerName,
    e.event_time AS Time,
    e.event_character AS Type,
    e.staff AS Staff,
    e.theme AS Subject,
    e.content AS Content
  FROM tb_event_record e
  LEFT JOIN tb_customer_information c ON e.customer_id = c.id
  WHERE 1=1
    AND (@customerId IS NULL OR e.customer_id = @customerId)
    AND (@eventCharacter IS NULL OR e.event_character = @eventCharacter)
    AND (@staff IS NULL OR e.staff LIKE CONCAT('%', @staff, '%'))
    AND (@from IS NULL OR e.event_time >= @from)
    AND (@to IS NULL OR e.event_time <= @to)
    AND (
          @keyword IS NULL
          OR c.name LIKE CONCAT('%', @keyword, '%')
          OR e.theme LIKE CONCAT('%', @keyword, '%')
          OR e.content LIKE CONCAT('%', @keyword, '%')
          OR e.staff LIKE CONCAT('%', @keyword, '%')
          OR e.event_character LIKE CONCAT('%', @keyword, '%')
        )

  UNION ALL

  SELECT
    'note' AS Source,
    CAST(n.id AS SIGNED) AS Id,
    n.customer_id AS CustomerId,
    c2.name AS CustomerName,
    n.created_at AS Time,
    'NOTE' AS Type,
    NULL AS Staff,
    '备注' AS Subject,
    n.content AS Content
  FROM tb_customer_note n
  LEFT JOIN tb_customer_information c2 ON n.customer_id = c2.id
  WHERE 1=1
    AND (@customerId IS NULL OR n.customer_id = @customerId)
    AND (@from IS NULL OR n.created_at >= @from)
    AND (@to IS NULL OR n.created_at <= @to)
    AND (
          @keyword IS NULL
          OR c2.name LIKE CONCAT('%', @keyword, '%')
          OR n.content LIKE CONCAT('%', @keyword, '%')
        )
) t
ORDER BY (t.Time IS NULL) ASC, t.Time DESC, t.Source ASC, t.Id DESC
LIMIT @pageSize OFFSET @offset;
";

        await using (var conn = new MySqlConnection(GetConnStr()))
        {
            await conn.OpenAsync();
            var total = await conn.ExecuteScalarAsync<int>(countAllSql, p);
            var items = (await conn.QueryAsync<ActivityItemDto>(listAllSql, p)).ToList();
            return new PagedResult<ActivityItemDto>(items, total);
        }
    }
}
