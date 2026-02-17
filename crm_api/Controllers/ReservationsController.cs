using Dapper;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;
using crm_api.Models;

namespace crm_api.Controllers;

/// <summary>
/// Calendar / Reservations（预约/日程）
/// 基于 tb_customer_reservation
///
/// ✅ 你之前 400 的根因：DB真实列名是 customer_name_id / registration_time / reservation_theme 等，
/// 但后端候选没覆盖到 -> 本文件已覆盖并自适配列名，且不匹配时吐出真实列名便于定位。
///
/// ✅ 这版把 reservation_method 独立映射为 Method（不再混到 Location）
/// - Method: 预约方式/渠道（电话/到店/线上/微信等）
/// - Location: 地点（如果你的表没有 location 列，也会自动为 null，不影响）
/// </summary>
[ApiController]
[Route("api")]
public class ReservationsController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ReservationsController(IConfiguration configuration)
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
    // DTO / Request
    // =========================
    public class ReservationDto
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }

        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }

        public string? Title { get; set; }
        public string? Content { get; set; }

        public string? Staff { get; set; }
        public string? Method { get; set; }     // ✅ reservation_method -> Method
        public string? Location { get; set; }   // ✅ location/address/place -> Location（可不存在）

        public string? Status { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public class CreateReservationRequest
    {
        public int CustomerId { get; set; }

        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }

        public string? Title { get; set; }
        public string? Content { get; set; }

        public string? Staff { get; set; }
        public string? Method { get; set; }     // ✅
        public string? Location { get; set; }

        public string? Status { get; set; }
    }

    public class UpdateReservationRequest
    {
        public int? CustomerId { get; set; }

        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }

        public string? Title { get; set; }
        public string? Content { get; set; }

        public string? Staff { get; set; }
        public string? Method { get; set; }     // ✅
        public string? Location { get; set; }

        public string? Status { get; set; }
    }

    // =========================
    // Schema helpers (adaptive columns)
    // =========================
    private static string? PickColumn(HashSet<string> cols, params string[] candidates)
    {
        foreach (var c in candidates)
        {
            if (cols.Contains(c)) return c;
        }
        return null;
    }

    private static string Q(string col) => $"`{col}`"; // MySQL identifier quoting

    private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
    {
        const string sql = @"
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'tb_customer_reservation';";

        var names = await conn.QueryAsync<string>(sql);
        return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
                    .Where(x => x.Length > 0)
                    .ToHashSet();
    }

    private class ReservationSchema
    {
        public string Table => "tb_customer_reservation";

        public string? CustomerIdCol { get; set; }
        public string? StartCol { get; set; }
        public string? EndCol { get; set; }
        public string? TitleCol { get; set; }
        public string? ContentCol { get; set; }
        public string? StaffCol { get; set; }
        public string? MethodCol { get; set; }    // ✅
        public string? LocationCol { get; set; }
        public string? StatusCol { get; set; }
        public string? CreatedAtCol { get; set; }

        public string OrderCol => StartCol ?? CreatedAtCol ?? "id";
    }

    private ReservationSchema BuildSchema(HashSet<string> cols)
    {
        // NOTE: cols 已经 lower 过
        var schema = new ReservationSchema
        {
            // ✅ 你的真实字段：customer_name_id
            CustomerIdCol = PickColumn(cols,
                "customer_name_id",
                "customer_id", "customerid",
                "customer_information_id", "customer_informationid",
                "customer_info_id", "customerinfoid",
                "customer_fk", "customerid_fk", "customer_ref", "customer_ref_id",
                "cid", "customer"
            ),

            // ✅ 你的真实字段：registration_time
            StartCol = PickColumn(cols,
                "registration_time",
                "reservation_time", "reservation_at",
                "reservation_datetime", "reservation_date_time",
                "reservation_date", "reservation_dt",
                "start_time", "start_at", "start_datetime", "start_date_time",
                "begin_time", "begin_at",
                "time", "datetime", "date_time"
            ),
            EndCol = PickColumn(cols,
                "end_time", "end_at", "end_datetime", "end_date_time",
                "finish_time", "finish_at", "to_time", "to_at"
            ),

            // ✅ 你的真实字段：reservation_theme / reservation_content / reservation_personnel
            TitleCol = PickColumn(cols,
                "reservation_theme",
                "title", "theme", "subject", "name"
            ),
            ContentCol = PickColumn(cols,
                "reservation_content",
                "content", "note", "notes", "remark", "description"
            ),
            StaffCol = PickColumn(cols,
                "reservation_personnel",
                "staff", "owner", "operator", "assigned_to"
            ),

            // ✅ 独立：预约方式/渠道（电话/到店/线上/微信…）
            MethodCol = PickColumn(cols,
                "reservation_method",
                "method", "channel", "type"
            ),

            // 地点字段（如果表里没有也没关系，返回 null）
            LocationCol = PickColumn(cols,
                "location", "address", "place"
            ),

            StatusCol = PickColumn(cols, "status", "state"),
            CreatedAtCol = PickColumn(cols, "created_at", "create_time", "created_time", "createdon")
        };

        return schema;
    }

    private static string DumpCols(HashSet<string> cols)
        => string.Join(", ", cols.OrderBy(x => x));

    private static DateTime NormalizeEnd(DateTime start, DateTime? end) => end ?? start;

    // =========================
    // 冲突检测（后端最终拦截）
    // =========================
    private async Task<ReservationDto?> FindConflictAsync(
        MySqlConnection conn,
        ReservationSchema schema,
        int? excludeId,
        string staff,
        DateTime startAt,
        DateTime? endAt
    )
    {
        if (string.IsNullOrWhiteSpace(staff)) return null;
        if (schema.StaffCol is null) return null;

        var startCol = schema.StartCol ?? schema.CreatedAtCol;
        if (startCol is null) return null;

        var endCol = schema.EndCol;

        var staffCol = Q(schema.StaffCol);
        var sCol = Q(startCol);
        var eExpr = endCol is null ? $"r.{sCol}" : $"COALESCE(r.{Q(endCol)}, r.{sCol})";

        var sql = $@"
SELECT
  r.id AS Id,
  r.{Q(schema.CustomerIdCol!)} AS CustomerId,
  c.name AS CustomerName,
  r.{sCol} AS StartAt,
  {(endCol is null ? "NULL" : $"r.{Q(endCol)}")} AS EndAt,
  {(schema.TitleCol is null ? "NULL" : $"r.{Q(schema.TitleCol)}")} AS Title,
  {(schema.ContentCol is null ? "NULL" : $"r.{Q(schema.ContentCol)}")} AS Content,
  {(schema.StaffCol is null ? "NULL" : $"r.{Q(schema.StaffCol)}")} AS Staff,
  {(schema.MethodCol is null ? "NULL" : $"r.{Q(schema.MethodCol)}")} AS Method,
  {(schema.LocationCol is null ? "NULL" : $"r.{Q(schema.LocationCol)}")} AS Location,
  {(schema.StatusCol is null ? "NULL" : $"r.{Q(schema.StatusCol)}")} AS Status,
  {(schema.CreatedAtCol is null ? "NULL" : $"r.{Q(schema.CreatedAtCol)}")} AS CreatedAt
FROM {schema.Table} r
LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol!)} = c.id
WHERE r.{staffCol} = @Staff
  {(excludeId is null ? "" : "AND r.id <> @ExcludeId")}
  AND r.{sCol} < @NewEnd
  AND {eExpr} > @NewStart
ORDER BY r.{sCol} ASC
LIMIT 1;
";
        var p = new DynamicParameters();
        p.Add("@Staff", staff.Trim());
        if (excludeId is not null) p.Add("@ExcludeId", excludeId.Value);

        var newStart = startAt;
        var newEnd = NormalizeEnd(startAt, endAt);
        p.Add("@NewStart", newStart);
        p.Add("@NewEnd", newEnd);

        return await conn.QueryFirstOrDefaultAsync<ReservationDto>(sql, p);
    }

    // =========================
    // GET /api/reservations
    // =========================
    [HttpGet("reservations")]
    [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? customerId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? keyword = null
    )
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : pageSize;
        pageSize = pageSize > 200 ? 200 : pageSize;
        var offset = (page - 1) * pageSize;

        keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var cols = await GetReservationColumnsAsync(conn);
        var schema = BuildSchema(cols);

        if (schema.CustomerIdCol is null)
        {
            return BadRequest(
                "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
                "当前列名：\n" + DumpCols(cols)
            );
        }

        var where = "WHERE 1=1 ";
        var p = new DynamicParameters();
        p.Add("@customerId", customerId);
        p.Add("@from", from);
        p.Add("@to", to);
        p.Add("@keyword", keyword);
        p.Add("@pageSize", pageSize);
        p.Add("@offset", offset);

        where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

        var timeCol = schema.StartCol ?? schema.CreatedAtCol;
        if (timeCol is not null)
        {
            where += $" AND (@from IS NULL OR r.{Q(timeCol)} >= @from) ";
            where += $" AND (@to IS NULL OR r.{Q(timeCol)} <= @to) ";
        }

        var kwParts = new List<string>();
        if (schema.TitleCol is not null) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
        if (schema.ContentCol is not null) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
        if (schema.StaffCol is not null) kwParts.Add($"r.{Q(schema.StaffCol)} LIKE CONCAT('%', @keyword, '%')");
        if (schema.MethodCol is not null) kwParts.Add($"r.{Q(schema.MethodCol)} LIKE CONCAT('%', @keyword, '%')");
        if (schema.LocationCol is not null) kwParts.Add($"r.{Q(schema.LocationCol)} LIKE CONCAT('%', @keyword, '%')");
        kwParts.Add($"c.name LIKE CONCAT('%', @keyword, '%')");

        where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

        string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

        var countSql = $@"
SELECT COUNT(1)
FROM {schema.Table} r
LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
{where};
";

        var listSql = $@"
SELECT
  r.id AS Id,
  r.{Q(schema.CustomerIdCol)} AS CustomerId,
  c.name AS CustomerName,
  {SelCol(schema.StartCol, "StartAt")},
  {SelCol(schema.EndCol, "EndAt")},
  {SelCol(schema.TitleCol, "Title")},
  {SelCol(schema.ContentCol, "Content")},
  {SelCol(schema.StaffCol, "Staff")},
  {SelCol(schema.MethodCol, "Method")},
  {SelCol(schema.LocationCol, "Location")},
  {SelCol(schema.StatusCol, "Status")},
  {SelCol(schema.CreatedAtCol, "CreatedAt")}
FROM {schema.Table} r
LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
{where}
ORDER BY r.{Q(schema.OrderCol)} DESC, r.id DESC
LIMIT @pageSize OFFSET @offset;
";

        var total = await conn.ExecuteScalarAsync<long>(countSql, p);
        var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

        return Ok(new PagedResult<ReservationDto>(items, total));
    }

    // GET /api/customers/{id}/reservations
    [HttpGet("customers/{customerId:int}/reservations")]
    [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
    public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
        int customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? keyword = null
    )
    {
        return GetReservations(page, pageSize, customerId, from, to, keyword);
    }

    // =========================
    // POST /api/reservations
    // =========================
    [HttpPost("reservations")]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
    {
        if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
        if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var cols = await GetReservationColumnsAsync(conn);
        var schema = BuildSchema(cols);

        if (schema.CustomerIdCol is null)
            return BadRequest("tb_customer_reservation 缺少可识别的 CustomerId 字段。\n当前列名：\n" + DumpCols(cols));

        var startCol = schema.StartCol ?? schema.CreatedAtCol;
        if (startCol is null)
            return BadRequest("tb_customer_reservation 没有可用的时间字段（registration_time/reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

        // ✅ 冲突检测：同一 Staff 时间段不能重叠
        if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
        {
            var conflict = await FindConflictAsync(conn, schema, null, req.Staff!.Trim(), req.StartAt!.Value, req.EndAt);
            if (conflict is not null)
            {
                return StatusCode(StatusCodes.Status409Conflict,
                    new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
            }
        }

        var insertCols = new List<string> { Q(schema.CustomerIdCol), Q(startCol) };
        var insertVals = new List<string> { "@CustomerId", "@StartAt" };

        var p = new DynamicParameters();
        p.Add("@CustomerId", req.CustomerId);
        p.Add("@StartAt", req.StartAt);

        if (schema.EndCol is not null && req.EndAt is not null)
        {
            insertCols.Add(Q(schema.EndCol));
            insertVals.Add("@EndAt");
            p.Add("@EndAt", req.EndAt);
        }

        if (schema.TitleCol is not null && !string.IsNullOrWhiteSpace(req.Title))
        {
            insertCols.Add(Q(schema.TitleCol));
            insertVals.Add("@Title");
            p.Add("@Title", req.Title!.Trim());
        }

        if (schema.ContentCol is not null && !string.IsNullOrWhiteSpace(req.Content))
        {
            insertCols.Add(Q(schema.ContentCol));
            insertVals.Add("@Content");
            p.Add("@Content", req.Content!.Trim());
        }

        if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
        {
            insertCols.Add(Q(schema.StaffCol));
            insertVals.Add("@Staff");
            p.Add("@Staff", req.Staff!.Trim());
        }

        if (schema.MethodCol is not null && !string.IsNullOrWhiteSpace(req.Method))
        {
            insertCols.Add(Q(schema.MethodCol));
            insertVals.Add("@Method");
            p.Add("@Method", req.Method!.Trim());
        }

        if (schema.LocationCol is not null && !string.IsNullOrWhiteSpace(req.Location))
        {
            insertCols.Add(Q(schema.LocationCol));
            insertVals.Add("@Location");
            p.Add("@Location", req.Location!.Trim());
        }

        if (schema.StatusCol is not null && !string.IsNullOrWhiteSpace(req.Status))
        {
            insertCols.Add(Q(schema.StatusCol));
            insertVals.Add("@Status");
            p.Add("@Status", req.Status!.Trim());
        }

        if (schema.CreatedAtCol is not null && schema.CreatedAtCol != startCol)
        {
            insertCols.Add(Q(schema.CreatedAtCol));
            insertVals.Add("NOW()");
        }

        var sql = $@"
INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
VALUES ({string.Join(", ", insertVals)});
SELECT LAST_INSERT_ID();
";

        int newId;
        try
        {
            newId = await conn.ExecuteScalarAsync<int>(sql, p);
        }
        catch (MySqlException ex)
        {
            return BadRequest($"创建预约失败：{ex.Message}");
        }

        string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

        var getSql = $@"
SELECT
  r.id AS Id,
  r.{Q(schema.CustomerIdCol)} AS CustomerId,
  c.name AS CustomerName,
  {SelCol(schema.StartCol, "StartAt")},
  {SelCol(schema.EndCol, "EndAt")},
  {SelCol(schema.TitleCol, "Title")},
  {SelCol(schema.ContentCol, "Content")},
  {SelCol(schema.StaffCol, "Staff")},
  {SelCol(schema.MethodCol, "Method")},
  {SelCol(schema.LocationCol, "Location")},
  {SelCol(schema.StatusCol, "Status")},
  {SelCol(schema.CreatedAtCol, "CreatedAt")}
FROM {schema.Table} r
LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
WHERE r.id = @Id
LIMIT 1;
";
        var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
        return Ok(created ?? new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });
    }

    // =========================
    // PUT /api/reservations/{id}
    // =========================
    [HttpPut("reservations/{id:int}")]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReservationDto>> Update(int id, [FromBody] UpdateReservationRequest req)
    {
        if (id <= 0) return BadRequest("id 无效");
        if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        var cols = await GetReservationColumnsAsync(conn);
        var schema = BuildSchema(cols);

        if (schema.CustomerIdCol is null)
            return BadRequest("tb_customer_reservation 缺少可识别的 CustomerId 字段。\n当前列名：\n" + DumpCols(cols));

        var startCol = schema.StartCol ?? schema.CreatedAtCol;
        if (startCol is null)
            return BadRequest("tb_customer_reservation 没有可用的时间字段（registration_time/reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

        if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
        {
            var conflict = await FindConflictAsync(conn, schema, id, req.Staff!.Trim(), req.StartAt!.Value, req.EndAt);
            if (conflict is not null)
            {
                return StatusCode(StatusCodes.Status409Conflict,
                    new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
            }
        }

        var sets = new List<string>();
        var p = new DynamicParameters();
        p.Add("@Id", id);

        if (req.CustomerId is not null && req.CustomerId.Value > 0)
        {
            sets.Add($"{Q(schema.CustomerIdCol)} = @CustomerId");
            p.Add("@CustomerId", req.CustomerId.Value);
        }

        sets.Add($"{Q(startCol)} = @StartAt");
        p.Add("@StartAt", req.StartAt);

        if (schema.EndCol is not null)
        {
            sets.Add($"{Q(schema.EndCol)} = @EndAt");
            p.Add("@EndAt", req.EndAt);
        }

        if (schema.TitleCol is not null)
        {
            sets.Add($"{Q(schema.TitleCol)} = @Title");
            p.Add("@Title", string.IsNullOrWhiteSpace(req.Title) ? null : req.Title!.Trim());
        }

        if (schema.ContentCol is not null)
        {
            sets.Add($"{Q(schema.ContentCol)} = @Content");
            p.Add("@Content", string.IsNullOrWhiteSpace(req.Content) ? null : req.Content!.Trim());
        }

        if (schema.StaffCol is not null)
        {
            sets.Add($"{Q(schema.StaffCol)} = @Staff");
            p.Add("@Staff", string.IsNullOrWhiteSpace(req.Staff) ? null : req.Staff!.Trim());
        }

        if (schema.MethodCol is not null)
        {
            sets.Add($"{Q(schema.MethodCol)} = @Method");
            p.Add("@Method", string.IsNullOrWhiteSpace(req.Method) ? null : req.Method!.Trim());
        }

        if (schema.LocationCol is not null)
        {
            sets.Add($"{Q(schema.LocationCol)} = @Location");
            p.Add("@Location", string.IsNullOrWhiteSpace(req.Location) ? null : req.Location!.Trim());
        }

        if (schema.StatusCol is not null)
        {
            sets.Add($"{Q(schema.StatusCol)} = @Status");
            p.Add("@Status", string.IsNullOrWhiteSpace(req.Status) ? null : req.Status!.Trim());
        }

        if (sets.Count == 0) return BadRequest("没有可更新字段");

        var sql = $@"UPDATE {schema.Table} SET {string.Join(", ", sets)} WHERE id = @Id;";
        try
        {
            var rows = await conn.ExecuteAsync(sql, p);
            if (rows <= 0) return NotFound();
        }
        catch (MySqlException ex)
        {
            return BadRequest($"更新预约失败：{ex.Message}");
        }

        string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

        var getSql = $@"
SELECT
  r.id AS Id,
  r.{Q(schema.CustomerIdCol)} AS CustomerId,
  c.name AS CustomerName,
  {SelCol(schema.StartCol, "StartAt")},
  {SelCol(schema.EndCol, "EndAt")},
  {SelCol(schema.TitleCol, "Title")},
  {SelCol(schema.ContentCol, "Content")},
  {SelCol(schema.StaffCol, "Staff")},
  {SelCol(schema.MethodCol, "Method")},
  {SelCol(schema.LocationCol, "Location")},
  {SelCol(schema.StatusCol, "Status")},
  {SelCol(schema.CreatedAtCol, "CreatedAt")}
FROM {schema.Table} r
LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
WHERE r.id = @Id
LIMIT 1;
";
        var updated = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = id });
        return Ok(updated ?? new ReservationDto { Id = id });
    }

    // =========================
    // DELETE /api/reservations/{id}
    // =========================
    [HttpDelete("reservations/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0) return BadRequest("id 无效");

        await using var conn = new MySqlConnection(GetConnStr());
        await conn.OpenAsync();

        const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
        try
        {
            var rows = await conn.ExecuteAsync(sql, new { Id = id });
            return rows > 0 ? Ok() : NotFound();
        }
        catch (MySqlException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}



















// using Dapper;
// using Microsoft.AspNetCore.Mvc;
// using MySqlConnector;
// using crm_api.Models;

// namespace crm_api.Controllers;

// /// <summary>
// /// Calendar / Reservations（预约/日程）
// /// 基于 tb_customer_reservation
// ///
// /// ✅ 本版在自适配列名候选中加入：
// /// customer_name_id / registration_time / reservation_theme / reservation_content / reservation_personnel / reservation_method
// /// 以匹配你当前数据库真实列名，修复 400 BadRequest（缺少可识别的 CustomerId 字段）
// /// </summary>
// [ApiController]
// [Route("api")]
// public class ReservationsController : ControllerBase
// {
//     private readonly IConfiguration _configuration;

//     public ReservationsController(IConfiguration configuration)
//     {
//         _configuration = configuration;
//     }

//     private string GetConnStr()
//     {
//         var connStr = _configuration.GetConnectionString("CrmDb");
//         if (string.IsNullOrWhiteSpace(connStr))
//             throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
//         return connStr;
//     }

//     // =========================
//     // DTO / Request
//     // =========================
//     public class ReservationDto
//     {
//         public int Id { get; set; }
//         public int CustomerId { get; set; }
//         public string? CustomerName { get; set; }

//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }

//         public string? Title { get; set; }
//         public string? Content { get; set; }

//         public string? Staff { get; set; }
//         public string? Location { get; set; }

//         public string? Status { get; set; }
//         public DateTime? CreatedAt { get; set; }
//     }

//     public class CreateReservationRequest
//     {
//         public int CustomerId { get; set; }

//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }

//         public string? Title { get; set; }
//         public string? Content { get; set; }

//         public string? Staff { get; set; }
//         public string? Location { get; set; }

//         public string? Status { get; set; }
//     }

//     // =========================
//     // Schema helpers (adaptive columns)
//     // =========================
//     private static string? PickColumn(HashSet<string> cols, params string[] candidates)
//     {
//         foreach (var c in candidates)
//         {
//             if (cols.Contains(c)) return c;
//         }
//         return null;
//     }

//     private static string Q(string col) => $"`{col}`"; // MySQL identifier quoting

//     private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
//     {
//         const string sql = @"
// SELECT COLUMN_NAME
// FROM information_schema.COLUMNS
// WHERE TABLE_SCHEMA = DATABASE()
//   AND TABLE_NAME = 'tb_customer_reservation';";

//         var names = await conn.QueryAsync<string>(sql);
//         return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
//                     .Where(x => x.Length > 0)
//                     .ToHashSet();
//     }

//     private class ReservationSchema
//     {
//         public string Table => "tb_customer_reservation";

//         public string? CustomerIdCol { get; set; }
//         public string? StartCol { get; set; }
//         public string? EndCol { get; set; }
//         public string? TitleCol { get; set; }
//         public string? ContentCol { get; set; }
//         public string? StaffCol { get; set; }
//         public string? LocationCol { get; set; }
//         public string? StatusCol { get; set; }
//         public string? CreatedAtCol { get; set; }

//         public string OrderCol => StartCol ?? CreatedAtCol ?? "id";
//     }

//     private ReservationSchema BuildSchema(HashSet<string> cols)
//     {
//         // NOTE: cols 已经 lower 过
//         var schema = new ReservationSchema
//         {
//             // ✅ 加入你库真实字段：customer_name_id
//             CustomerIdCol = PickColumn(cols,
//                 "customer_name_id",            // ✅ your real column
//                 "customer_id", "customerid",
//                 "customer_information_id", "customer_informationid",
//                 "customer_info_id", "customerinfoid",
//                 "customer_fk", "customerid_fk", "customer_ref", "customer_ref_id",
//                 "cid", "customer"
//             ),

//             // ✅ 加入你库真实字段：registration_time
//             StartCol = PickColumn(cols,
//                 "registration_time",           // ✅ your real column
//                 "reservation_time", "reservation_at",
//                 "reservation_datetime", "reservation_date_time",
//                 "reservation_date", "reservation_dt",
//                 "start_time", "start_at", "start_datetime", "start_date_time",
//                 "begin_time", "begin_at",
//                 "time", "datetime", "date_time"
//             ),

//             // 你库里本来就有 end_time（已命中）
//             EndCol = PickColumn(cols,
//                 "end_time", "end_at", "end_datetime", "end_date_time",
//                 "finish_time", "finish_at", "to_time", "to_at"
//             ),

//             // ✅ 加入你库真实字段：reservation_theme
//             TitleCol = PickColumn(cols,
//                 "reservation_theme",           // ✅ your real column
//                 "title", "theme", "subject", "name"
//             ),

//             // ✅ 加入你库真实字段：reservation_content
//             ContentCol = PickColumn(cols,
//                 "reservation_content",         // ✅ your real column
//                 "content", "note", "notes", "remark", "description"
//             ),

//             // ✅ 加入你库真实字段：reservation_personnel
//             StaffCol = PickColumn(cols,
//                 "reservation_personnel",       // ✅ your real column
//                 "staff", "owner", "operator", "assigned_to"
//             ),

//             // ✅ 你库里有 reservation_method，可暂时映射到 Location（如果你想后续拆成 Method 字段也行）
//             LocationCol = PickColumn(cols,
//                 "reservation_method",          // ✅ your real column (mapped as Location)
//                 "location", "address", "place"
//             ),

//             StatusCol = PickColumn(cols, "status", "state"),

//             // ✅ 你库里不一定有 created_at；如果没有也没问题，会 fallback 到 StartCol 或 id 排序
//             CreatedAtCol = PickColumn(cols, "created_at", "create_time", "created_time", "createdon")
//         };

//         return schema;
//     }

//     private static string DumpCols(HashSet<string> cols)
//         => string.Join(", ", cols.OrderBy(x => x));

//     // =========================
//     // GET /api/reservations
//     // =========================
//     [HttpGet("reservations")]
//     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
//     public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
//         [FromQuery] int page = 1,
//         [FromQuery] int pageSize = 20,
//         [FromQuery] int? customerId = null,
//         [FromQuery] DateTime? from = null,
//         [FromQuery] DateTime? to = null,
//         [FromQuery] string? keyword = null
//     )
//     {
//         page = page < 1 ? 1 : page;
//         pageSize = pageSize < 1 ? 20 : pageSize;
//         pageSize = pageSize > 200 ? 200 : pageSize;
//         var offset = (page - 1) * pageSize;

//         keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//         {
//             return BadRequest(
//                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
//                 "当前列名：\n" + DumpCols(cols)
//             );
//         }

//         // build where
//         var where = "WHERE 1=1 ";
//         var p = new DynamicParameters();
//         p.Add("@customerId", customerId);
//         p.Add("@from", from);
//         p.Add("@to", to);
//         p.Add("@keyword", keyword);
//         p.Add("@pageSize", pageSize);
//         p.Add("@offset", offset);

//         where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

//         // time range filter: use start col if exists, otherwise created_at
//         var timeCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (timeCol is not null)
//         {
//             where += $" AND (@from IS NULL OR r.{Q(timeCol)} >= @from) ";
//             where += $" AND (@to IS NULL OR r.{Q(timeCol)} <= @to) ";
//         }

//         // keyword filter (best effort)
//         var kwParts = new List<string>();
//         if (schema.TitleCol is not null) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.ContentCol is not null) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.StaffCol is not null) kwParts.Add($"r.{Q(schema.StaffCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.LocationCol is not null) kwParts.Add($"r.{Q(schema.LocationCol)} LIKE CONCAT('%', @keyword, '%')");
//         kwParts.Add($"c.name LIKE CONCAT('%', @keyword, '%')");

//         where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var countSql = $@"
// SELECT COUNT(1)
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// {where};
// ";

//         var listSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// {where}
// ORDER BY r.{Q(schema.OrderCol)} DESC, r.id DESC
// LIMIT @pageSize OFFSET @offset;
// ";

//         var total = await conn.ExecuteScalarAsync<long>(countSql, p);
//         var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

//         return Ok(new PagedResult<ReservationDto>(items, total));
//     }

//     // =========================
//     // GET /api/customers/{id}/reservations
//     // =========================
//     [HttpGet("customers/{customerId:int}/reservations")]
//     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
//     public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
//         int customerId,
//         [FromQuery] int page = 1,
//         [FromQuery] int pageSize = 20,
//         [FromQuery] DateTime? from = null,
//         [FromQuery] DateTime? to = null,
//         [FromQuery] string? keyword = null
//     )
//     {
//         return GetReservations(page, pageSize, customerId, from, to, keyword);
//     }

//     // =========================
//     // 冲突检测（后端最终拦截）
//     // =========================
//     private static DateTime NormalizeEnd(DateTime start, DateTime? end) => end ?? start;

//     private async Task<ReservationDto?> FindConflictAsync(
//         MySqlConnection conn,
//         ReservationSchema schema,
//         int? excludeId,
//         string staff,
//         DateTime startAt,
//         DateTime? endAt
//     )
//     {
//         if (string.IsNullOrWhiteSpace(staff)) return null;
//         if (schema.StaffCol is null) return null;

//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null) return null;

//         var endCol = schema.EndCol;

//         var staffCol = Q(schema.StaffCol);
//         var sCol = Q(startCol);
//         var eExpr = endCol is null ? $"r.{sCol}" : $"COALESCE(r.{Q(endCol)}, r.{sCol})";

//         var sql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol!)} AS CustomerId,
//   c.name AS CustomerName,
//   r.{sCol} AS StartAt,
//   {(endCol is null ? "NULL" : $"r.{Q(endCol)}")} AS EndAt,
//   {(schema.TitleCol is null ? "NULL" : $"r.{Q(schema.TitleCol)}")} AS Title,
//   {(schema.ContentCol is null ? "NULL" : $"r.{Q(schema.ContentCol)}")} AS Content,
//   {(schema.StaffCol is null ? "NULL" : $"r.{Q(schema.StaffCol)}")} AS Staff,
//   {(schema.LocationCol is null ? "NULL" : $"r.{Q(schema.LocationCol)}")} AS Location,
//   {(schema.StatusCol is null ? "NULL" : $"r.{Q(schema.StatusCol)}")} AS Status,
//   {(schema.CreatedAtCol is null ? "NULL" : $"r.{Q(schema.CreatedAtCol)}")} AS CreatedAt
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol!)} = c.id
// WHERE r.{staffCol} = @Staff
//   {(excludeId is null ? "" : "AND r.id <> @ExcludeId")}
//   AND r.{sCol} < @NewEnd
//   AND {eExpr} > @NewStart
// ORDER BY r.{sCol} ASC
// LIMIT 1;
// ";
//         var p = new DynamicParameters();
//         p.Add("@Staff", staff.Trim());
//         if (excludeId is not null) p.Add("@ExcludeId", excludeId.Value);

//         var newStart = startAt;
//         var newEnd = NormalizeEnd(startAt, endAt);
//         p.Add("@NewStart", newStart);
//         p.Add("@NewEnd", newEnd);

//         return await conn.QueryFirstOrDefaultAsync<ReservationDto>(sql, p);
//     }

//     // =========================
//     // POST /api/reservations
//     // =========================
//     [HttpPost("reservations")]
//     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
//     public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
//     {
//         if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
//         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//             return BadRequest("tb_customer_reservation 缺少可识别的 CustomerId 字段。\n当前列名：\n" + DumpCols(cols));

//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null)
//             return BadRequest("tb_customer_reservation 没有可用的时间字段（registration_time/reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

//         // ✅ 后端最终冲突检测：同一 Staff 时间段不能重叠
//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             var conflict = await FindConflictAsync(conn, schema, null, req.Staff!.Trim(), req.StartAt!.Value, req.EndAt);
//             if (conflict is not null)
//             {
//                 return StatusCode(StatusCodes.Status409Conflict,
//                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
//             }
//         }

//         var insertCols = new List<string> { Q(schema.CustomerIdCol), Q(startCol) };
//         var insertVals = new List<string> { "@CustomerId", "@StartAt" };

//         var p = new DynamicParameters();
//         p.Add("@CustomerId", req.CustomerId);
//         p.Add("@StartAt", req.StartAt);

//         if (schema.EndCol is not null && req.EndAt is not null)
//         {
//             insertCols.Add(Q(schema.EndCol));
//             insertVals.Add("@EndAt");
//             p.Add("@EndAt", req.EndAt);
//         }

//         if (schema.TitleCol is not null && !string.IsNullOrWhiteSpace(req.Title))
//         {
//             insertCols.Add(Q(schema.TitleCol));
//             insertVals.Add("@Title");
//             p.Add("@Title", req.Title!.Trim());
//         }

//         if (schema.ContentCol is not null && !string.IsNullOrWhiteSpace(req.Content))
//         {
//             insertCols.Add(Q(schema.ContentCol));
//             insertVals.Add("@Content");
//             p.Add("@Content", req.Content!.Trim());
//         }

//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             insertCols.Add(Q(schema.StaffCol));
//             insertVals.Add("@Staff");
//             p.Add("@Staff", req.Staff!.Trim());
//         }

//         if (schema.LocationCol is not null && !string.IsNullOrWhiteSpace(req.Location))
//         {
//             insertCols.Add(Q(schema.LocationCol));
//             insertVals.Add("@Location");
//             p.Add("@Location", req.Location!.Trim());
//         }

//         if (schema.StatusCol is not null && !string.IsNullOrWhiteSpace(req.Status))
//         {
//             insertCols.Add(Q(schema.StatusCol));
//             insertVals.Add("@Status");
//             p.Add("@Status", req.Status!.Trim());
//         }

//         if (schema.CreatedAtCol is not null && schema.CreatedAtCol != startCol)
//         {
//             insertCols.Add(Q(schema.CreatedAtCol));
//             insertVals.Add("NOW()");
//         }

//         var sql = $@"
// INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
// VALUES ({string.Join(", ", insertVals)});
// SELECT LAST_INSERT_ID();
// ";

//         int newId;
//         try
//         {
//             newId = await conn.ExecuteScalarAsync<int>(sql, p);
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest($"创建预约失败：{ex.Message}");
//         }

//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var getSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// WHERE r.id = @Id
// LIMIT 1;
// ";
//         var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
//         return Ok(created ?? new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });
//     }

//     // =========================
//     // PUT /api/reservations/{id}
//     // =========================
//     [HttpPut("reservations/{id:int}")]
//     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
//     public async Task<ActionResult<ReservationDto>> Update(int id, [FromBody] UpdateReservationRequest req)
//     {
//         if (id <= 0) return BadRequest("id 无效");
//         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//             return BadRequest("tb_customer_reservation 缺少可识别的 CustomerId 字段。\n当前列名：\n" + DumpCols(cols));

//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null)
//             return BadRequest("tb_customer_reservation 没有可用的时间字段（registration_time/reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             var conflict = await FindConflictAsync(conn, schema, id, req.Staff!.Trim(), req.StartAt!.Value, req.EndAt);
//             if (conflict is not null)
//             {
//                 return StatusCode(StatusCodes.Status409Conflict,
//                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
//             }
//         }

//         var sets = new List<string>();
//         var p = new DynamicParameters();
//         p.Add("@Id", id);

//         if (req.CustomerId is not null && req.CustomerId.Value > 0)
//         {
//             sets.Add($"{Q(schema.CustomerIdCol)} = @CustomerId");
//             p.Add("@CustomerId", req.CustomerId.Value);
//         }

//         sets.Add($"{Q(startCol)} = @StartAt");
//         p.Add("@StartAt", req.StartAt);

//         if (schema.EndCol is not null)
//         {
//             sets.Add($"{Q(schema.EndCol)} = @EndAt");
//             p.Add("@EndAt", req.EndAt);
//         }

//         if (schema.TitleCol is not null)
//         {
//             sets.Add($"{Q(schema.TitleCol)} = @Title");
//             p.Add("@Title", string.IsNullOrWhiteSpace(req.Title) ? null : req.Title!.Trim());
//         }

//         if (schema.ContentCol is not null)
//         {
//             sets.Add($"{Q(schema.ContentCol)} = @Content");
//             p.Add("@Content", string.IsNullOrWhiteSpace(req.Content) ? null : req.Content!.Trim());
//         }

//         if (schema.StaffCol is not null)
//         {
//             sets.Add($"{Q(schema.StaffCol)} = @Staff");
//             p.Add("@Staff", string.IsNullOrWhiteSpace(req.Staff) ? null : req.Staff!.Trim());
//         }

//         if (schema.LocationCol is not null)
//         {
//             sets.Add($"{Q(schema.LocationCol)} = @Location");
//             p.Add("@Location", string.IsNullOrWhiteSpace(req.Location) ? null : req.Location!.Trim());
//         }

//         if (schema.StatusCol is not null)
//         {
//             sets.Add($"{Q(schema.StatusCol)} = @Status");
//             p.Add("@Status", string.IsNullOrWhiteSpace(req.Status) ? null : req.Status!.Trim());
//         }

//         if (sets.Count == 0) return BadRequest("没有可更新字段");

//         var sql = $@"UPDATE {schema.Table} SET {string.Join(", ", sets)} WHERE id = @Id;";
//         try
//         {
//             var rows = await conn.ExecuteAsync(sql, p);
//             if (rows <= 0) return NotFound();
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest($"更新预约失败：{ex.Message}");
//         }

//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var getSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// WHERE r.id = @Id
// LIMIT 1;
// ";
//         var updated = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = id });
//         return Ok(updated ?? new ReservationDto { Id = id });
//     }

//     public class UpdateReservationRequest
//     {
//         public int? CustomerId { get; set; }
//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }
//         public string? Title { get; set; }
//         public string? Content { get; set; }
//         public string? Staff { get; set; }
//         public string? Location { get; set; }
//         public string? Status { get; set; }
//     }

//     // =========================
//     // DELETE /api/reservations/{id}
//     // =========================
//     [HttpDelete("reservations/{id:int}")]
//     public async Task<IActionResult> Delete(int id)
//     {
//         if (id <= 0) return BadRequest("id 无效");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
//         try
//         {
//             var rows = await conn.ExecuteAsync(sql, new { Id = id });
//             return rows > 0 ? Ok() : NotFound();
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest(ex.Message);
//         }
//     }
// }


























// using Dapper;
// using Microsoft.AspNetCore.Mvc;
// using MySqlConnector;
// using crm_api.Models;

// namespace crm_api.Controllers;

// /// <summary>
// /// Calendar / Reservations（预约/日程）
// /// 基于 tb_customer_reservation
// ///
// /// ✅ 你之前 GET /api/reservations 返回 400（text/plain），说明字段命名不匹配。
// /// 本版扩大字段候选范围，并在仍不匹配时把真实列名吐出来，方便一次性精确适配。
// ///
// /// ✅ 同时修复编译错误：你的 PagedResult 是 record/带构造函数（Items, Total），必须用构造器 new PagedResult(items, total)。
// /// </summary>
// [ApiController]
// [Route("api")]
// public class ReservationsController : ControllerBase
// {
//     private readonly IConfiguration _configuration;

//     public ReservationsController(IConfiguration configuration)
//     {
//         _configuration = configuration;
//     }

//     private string GetConnStr()
//     {
//         var connStr = _configuration.GetConnectionString("CrmDb");
//         if (string.IsNullOrWhiteSpace(connStr))
//             throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
//         return connStr;
//     }

//     // =========================
//     // DTO / Request
//     // =========================
//     public class ReservationDto
//     {
//         public int Id { get; set; }
//         public int CustomerId { get; set; }
//         public string? CustomerName { get; set; }

//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }

//         public string? Title { get; set; }
//         public string? Content { get; set; }

//         public string? Staff { get; set; }
//         public string? Location { get; set; }

//         public string? Status { get; set; }
//         public DateTime? CreatedAt { get; set; }
//     }

//     public class CreateReservationRequest
//     {
//         public int CustomerId { get; set; }

//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }

//         public string? Title { get; set; }
//         public string? Content { get; set; }

//         public string? Staff { get; set; }
//         public string? Location { get; set; }

//         public string? Status { get; set; }
//     }

//     // =========================
//     // Schema helpers (adaptive columns)
//     // =========================
//     private static string? PickColumn(HashSet<string> cols, params string[] candidates)
//     {
//         foreach (var c in candidates)
//         {
//             if (cols.Contains(c)) return c;
//         }
//         return null;
//     }

//     private static string Q(string col) => $"`{col}`"; // MySQL identifier quoting

//     private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
//     {
//         const string sql = @"
// SELECT COLUMN_NAME
// FROM information_schema.COLUMNS
// WHERE TABLE_SCHEMA = DATABASE()
//   AND TABLE_NAME = 'tb_customer_reservation';";

//         var names = await conn.QueryAsync<string>(sql);
//         return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
//                     .Where(x => x.Length > 0)
//                     .ToHashSet();
//     }

//     private class ReservationSchema
//     {
//         public string Table => "tb_customer_reservation";

//         public string? CustomerIdCol { get; set; }
//         public string? StartCol { get; set; }
//         public string? EndCol { get; set; }
//         public string? TitleCol { get; set; }
//         public string? ContentCol { get; set; }
//         public string? StaffCol { get; set; }
//         public string? LocationCol { get; set; }
//         public string? StatusCol { get; set; }
//         public string? CreatedAtCol { get; set; }

//         public string OrderCol => StartCol ?? CreatedAtCol ?? "id";
//     }

//     private ReservationSchema BuildSchema(HashSet<string> cols)
//     {
//         // NOTE: cols 已经 lower 过
//         var schema = new ReservationSchema
//         {
//             // ✅ 扩大 customerId 候选范围
//             CustomerIdCol = PickColumn(cols,
//                 "customer_id", "customerid",
//                 "customer_information_id", "customer_informationid",
//                 "customer_info_id", "customerinfoid",
//                 "customer_fk", "customerid_fk", "customer_ref", "customer_ref_id",
//                 "cid", "customer"
//             ),

//             // ✅ 时间字段候选
//             StartCol = PickColumn(cols,
//                 "reservation_time", "reservation_at",
//                 "reservation_datetime", "reservation_date_time",
//                 "reservation_date", "reservation_dt",
//                 "start_time", "start_at", "start_datetime", "start_date_time",
//                 "begin_time", "begin_at",
//                 "time", "datetime", "date_time"
//             ),
//             EndCol = PickColumn(cols,
//                 "end_time", "end_at", "end_datetime", "end_date_time",
//                 "finish_time", "finish_at", "to_time", "to_at"
//             ),

//             TitleCol = PickColumn(cols, "title", "theme", "subject", "name"),
//             ContentCol = PickColumn(cols, "content", "note", "notes", "remark", "description"),
//             StaffCol = PickColumn(cols, "staff", "owner", "operator", "assigned_to"),
//             LocationCol = PickColumn(cols, "location", "address", "place"),
//             StatusCol = PickColumn(cols, "status", "state"),
//             CreatedAtCol = PickColumn(cols, "created_at", "create_time", "created_time", "createdon")
//         };

//         return schema;
//     }

//     private static string DumpCols(HashSet<string> cols)
//         => string.Join(", ", cols.OrderBy(x => x));

//     // =========================
//     // GET /api/reservations
//     // =========================
//     [HttpGet("reservations")]
//     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
//     public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
//         [FromQuery] int page = 1,
//         [FromQuery] int pageSize = 20,
//         [FromQuery] int? customerId = null,
//         [FromQuery] DateTime? from = null,
//         [FromQuery] DateTime? to = null,
//         [FromQuery] string? keyword = null
//     )
//     {
//         page = page < 1 ? 1 : page;
//         pageSize = pageSize < 1 ? 20 : pageSize;
//         pageSize = pageSize > 200 ? 200 : pageSize;
//         var offset = (page - 1) * pageSize;

//         keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//         {
//             return BadRequest(
//                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
//                 "我已尝试候选：customer_id / customer_information_id / customer_fk 等。\n" +
//                 "请把下面列名发我（或直接截图这个 400 Response），我会立刻精确适配：\n" +
//                 DumpCols(cols)
//             );
//         }

//         // build where
//         var where = "WHERE 1=1 ";
//         var p = new DynamicParameters();
//         p.Add("@customerId", customerId);
//         p.Add("@from", from);
//         p.Add("@to", to);
//         p.Add("@keyword", keyword);
//         p.Add("@pageSize", pageSize);
//         p.Add("@offset", offset);

//         where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

//         // time range filter: use start col if exists, otherwise created_at
//         var timeCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (timeCol is not null)
//         {
//             where += $" AND (@from IS NULL OR r.{Q(timeCol)} >= @from) ";
//             where += $" AND (@to IS NULL OR r.{Q(timeCol)} <= @to) ";
//         }

//         // keyword filter (best effort)
//         var kwParts = new List<string>();
//         if (schema.TitleCol is not null) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.ContentCol is not null) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.StaffCol is not null) kwParts.Add($"r.{Q(schema.StaffCol)} LIKE CONCAT('%', @keyword, '%')");
//         if (schema.LocationCol is not null) kwParts.Add($"r.{Q(schema.LocationCol)} LIKE CONCAT('%', @keyword, '%')");
//         // customer name 依赖 tb_customer_information 的 name
//         kwParts.Add($"c.name LIKE CONCAT('%', @keyword, '%')");

//         where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

//         // SELECT with safe aliases
//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var countSql = $@"
// SELECT COUNT(1)
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// {where};
// ";

//         var listSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// {where}
// ORDER BY r.{Q(schema.OrderCol)} DESC, r.id DESC
// LIMIT @pageSize OFFSET @offset;
// ";

//         var total = await conn.ExecuteScalarAsync<long>(countSql, p);
//         var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

//         // ✅ 你的 PagedResult 是 record/有构造器：PagedResult(IReadOnlyList<T> Items, long Total)
//         return Ok(new PagedResult<ReservationDto>(items, total));
//     }

//     // =========================
//     // GET /api/customers/{id}/reservations
//     // =========================
//     [HttpGet("customers/{customerId:int}/reservations")]
//     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
//     public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
//         int customerId,
//         [FromQuery] int page = 1,
//         [FromQuery] int pageSize = 20,
//         [FromQuery] DateTime? from = null,
//         [FromQuery] DateTime? to = null,
//         [FromQuery] string? keyword = null
//     )
//     {
//         return GetReservations(page, pageSize, customerId, from, to, keyword);
//     }

    
//     // =========================
//     // 冲突检测（后端最终拦截）
//     // =========================
//     private static DateTime NormalizeEnd(DateTime start, DateTime? end) => end ?? start;

//     private static bool IsOverlapping(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd)
//         => aStart < bEnd && aEnd > bStart; // 严格不等：允许 end == start 不算冲突

//     private async Task<ReservationDto?> FindConflictAsync(
//         MySqlConnection conn,
//         ReservationSchema schema,
//         int? excludeId,
//         string staff,
//         DateTime startAt,
//         DateTime? endAt
//     )
//     {
//         if (string.IsNullOrWhiteSpace(staff)) return null;
//         if (schema.StaffCol is null) return null;

//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null) return null; // 没有时间字段，无法检测

//         var endCol = schema.EndCol; // 允许为空

//         // ✅ 使用 COALESCE(end, start) 处理 end 为空的情况
//         var staffCol = Q(schema.StaffCol);
//         var sCol = Q(startCol);
//         var eExpr = endCol is null ? $"r.{sCol}" : $"COALESCE(r.{Q(endCol)}, r.{sCol})";

//         var sql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol!)} AS CustomerId,
//   c.name AS CustomerName,
//   r.{sCol} AS StartAt,
//   {(endCol is null ? "NULL" : $"r.{Q(endCol)}")} AS EndAt,
//   {(schema.TitleCol is null ? "NULL" : $"r.{Q(schema.TitleCol)}")} AS Title,
//   {(schema.ContentCol is null ? "NULL" : $"r.{Q(schema.ContentCol)}")} AS Content,
//   {(schema.StaffCol is null ? "NULL" : $"r.{Q(schema.StaffCol)}")} AS Staff,
//   {(schema.LocationCol is null ? "NULL" : $"r.{Q(schema.LocationCol)}")} AS Location,
//   {(schema.StatusCol is null ? "NULL" : $"r.{Q(schema.StatusCol)}")} AS Status,
//   {(schema.CreatedAtCol is null ? "NULL" : $"r.{Q(schema.CreatedAtCol)}")} AS CreatedAt
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol!)} = c.id
// WHERE r.{staffCol} = @Staff
//   {(excludeId is null ? "" : "AND r.id <> @ExcludeId")}
//   AND r.{sCol} < @NewEnd
//   AND {eExpr} > @NewStart
// ORDER BY r.{sCol} ASC
// LIMIT 1;
// ";
//         var p = new DynamicParameters();
//         p.Add("@Staff", staff.Trim());
//         if (excludeId is not null) p.Add("@ExcludeId", excludeId.Value);

//         var newStart = startAt;
//         var newEnd = NormalizeEnd(startAt, endAt);
//         p.Add("@NewStart", newStart);
//         p.Add("@NewEnd", newEnd);

//         return await conn.QueryFirstOrDefaultAsync<ReservationDto>(sql, p);
//     }

// // =========================
//     // POST /api/reservations
//     // =========================
//     [HttpPost("reservations")]
//     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
//     public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
//     {
//         if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
//         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//         {
//             return BadRequest(
//                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
//                 "当前列名：\n" + DumpCols(cols)
//             );
//         }

//         // choose a time col to insert
//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null)
//             return BadRequest("tb_customer_reservation 没有可用的时间字段（reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

//         // ✅ 后端最终冲突检测：同一 Staff 时间段不能重叠
//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             var conflict = await FindConflictAsync(
//                 conn,
//                 schema,
//                 excludeId: null,
//                 staff: req.Staff!.Trim(),
//                 startAt: req.StartAt!.Value,
//                 endAt: req.EndAt
//             );

//             if (conflict is not null)
//             {
//                 return StatusCode(StatusCodes.Status409Conflict,
//                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
//             }
//         }

//         var insertCols = new List<string> { Q(schema.CustomerIdCol), Q(startCol) };
//         var insertVals = new List<string> { "@CustomerId", "@StartAt" };

//         var p = new DynamicParameters();
//         p.Add("@CustomerId", req.CustomerId);
//         p.Add("@StartAt", req.StartAt);

//         if (schema.EndCol is not null && req.EndAt is not null)
//         {
//             insertCols.Add(Q(schema.EndCol));
//             insertVals.Add("@EndAt");
//             p.Add("@EndAt", req.EndAt);
//         }

//         if (schema.TitleCol is not null && !string.IsNullOrWhiteSpace(req.Title))
//         {
//             insertCols.Add(Q(schema.TitleCol));
//             insertVals.Add("@Title");
//             p.Add("@Title", req.Title!.Trim());
//         }

//         if (schema.ContentCol is not null && !string.IsNullOrWhiteSpace(req.Content))
//         {
//             insertCols.Add(Q(schema.ContentCol));
//             insertVals.Add("@Content");
//             p.Add("@Content", req.Content!.Trim());
//         }

//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             insertCols.Add(Q(schema.StaffCol));
//             insertVals.Add("@Staff");
//             p.Add("@Staff", req.Staff!.Trim());
//         }

//         if (schema.LocationCol is not null && !string.IsNullOrWhiteSpace(req.Location))
//         {
//             insertCols.Add(Q(schema.LocationCol));
//             insertVals.Add("@Location");
//             p.Add("@Location", req.Location!.Trim());
//         }

//         if (schema.StatusCol is not null && !string.IsNullOrWhiteSpace(req.Status))
//         {
//             insertCols.Add(Q(schema.StatusCol));
//             insertVals.Add("@Status");
//             p.Add("@Status", req.Status!.Trim());
//         }

//         // if created_at exists and is different from startCol, set NOW()
//         if (schema.CreatedAtCol is not null && schema.CreatedAtCol != startCol)
//         {
//             insertCols.Add(Q(schema.CreatedAtCol));
//             insertVals.Add("NOW()");
//         }

//         var sql = $@"
// INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
// VALUES ({string.Join(", ", insertVals)});
// SELECT LAST_INSERT_ID();
// ";

//         int newId;
//         try
//         {
//             newId = await conn.ExecuteScalarAsync<int>(sql, p);
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest($"创建预约失败：{ex.Message}");
//         }

//         // read back
//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var getSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// WHERE r.id = @Id
// LIMIT 1;
// ";
//         var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
//         return Ok(created ?? new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });
//     }

    
//     // =========================
//     // PUT /api/reservations/{id}
//     // 用于拖拽/拉伸/抽屉编辑保存
//     // =========================
//     [HttpPut("reservations/{id:int}")]
//     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
//     public async Task<ActionResult<ReservationDto>> Update(int id, [FromBody] UpdateReservationRequest req)
//     {
//         if (id <= 0) return BadRequest("id 无效");
//         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         var cols = await GetReservationColumnsAsync(conn);
//         var schema = BuildSchema(cols);

//         if (schema.CustomerIdCol is null)
//         {
//             return BadRequest(
//                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
//                 "当前列名：\n" + DumpCols(cols)
//             );
//         }

//         var startCol = schema.StartCol ?? schema.CreatedAtCol;
//         if (startCol is null)
//             return BadRequest("tb_customer_reservation 没有可用的时间字段（reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

//         // ✅ 后端最终冲突检测：同一 Staff 时间段不能重叠
//         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
//         {
//             var conflict = await FindConflictAsync(conn, schema, excludeId: id, staff: req.Staff!.Trim(), startAt: req.StartAt!.Value, endAt: req.EndAt);
//             if (conflict is not null)
//             {
//                 return StatusCode(StatusCodes.Status409Conflict,
//                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
//             }
//         }

//         var sets = new List<string>();
//         var p = new DynamicParameters();
//         p.Add("@Id", id);

//         // CustomerId（可选）
//         if (req.CustomerId is not null && req.CustomerId.Value > 0)
//         {
//             sets.Add($"{Q(schema.CustomerIdCol)} = @CustomerId");
//             p.Add("@CustomerId", req.CustomerId.Value);
//         }

//         // StartAt/EndAt
//         sets.Add($"{Q(startCol)} = @StartAt");
//         p.Add("@StartAt", req.StartAt);

//         if (schema.EndCol is not null)
//         {
//             sets.Add($"{Q(schema.EndCol)} = @EndAt");
//             p.Add("@EndAt", req.EndAt);
//         }

//         // Title/Content/Staff/Location/Status
//         if (schema.TitleCol is not null)
//         {
//             sets.Add($"{Q(schema.TitleCol)} = @Title");
//             p.Add("@Title", string.IsNullOrWhiteSpace(req.Title) ? null : req.Title!.Trim());
//         }

//         if (schema.ContentCol is not null)
//         {
//             sets.Add($"{Q(schema.ContentCol)} = @Content");
//             p.Add("@Content", string.IsNullOrWhiteSpace(req.Content) ? null : req.Content!.Trim());
//         }

//         if (schema.StaffCol is not null)
//         {
//             sets.Add($"{Q(schema.StaffCol)} = @Staff");
//             p.Add("@Staff", string.IsNullOrWhiteSpace(req.Staff) ? null : req.Staff!.Trim());
//         }

//         if (schema.LocationCol is not null)
//         {
//             sets.Add($"{Q(schema.LocationCol)} = @Location");
//             p.Add("@Location", string.IsNullOrWhiteSpace(req.Location) ? null : req.Location!.Trim());
//         }

//         if (schema.StatusCol is not null)
//         {
//             sets.Add($"{Q(schema.StatusCol)} = @Status");
//             p.Add("@Status", string.IsNullOrWhiteSpace(req.Status) ? null : req.Status!.Trim());
//         }

//         if (sets.Count == 0) return BadRequest("没有可更新字段");

//         var sql = $@"UPDATE {schema.Table} SET {string.Join(", ", sets)} WHERE id = @Id;";
//         try
//         {
//             var rows = await conn.ExecuteAsync(sql, p);
//             if (rows <= 0) return NotFound();
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest($"更新预约失败：{ex.Message}");
//         }

//         // read back
//         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

//         var getSql = $@"
// SELECT
//   r.id AS Id,
//   r.{Q(schema.CustomerIdCol)} AS CustomerId,
//   c.name AS CustomerName,
//   {SelCol(schema.StartCol, "StartAt")},
//   {SelCol(schema.EndCol, "EndAt")},
//   {SelCol(schema.TitleCol, "Title")},
//   {SelCol(schema.ContentCol, "Content")},
//   {SelCol(schema.StaffCol, "Staff")},
//   {SelCol(schema.LocationCol, "Location")},
//   {SelCol(schema.StatusCol, "Status")},
//   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// FROM {schema.Table} r
// LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// WHERE r.id = @Id
// LIMIT 1;
// ";
//         var updated = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = id });
//         return Ok(updated ?? new ReservationDto { Id = id });
//     }

//     public class UpdateReservationRequest
//     {
//         public int? CustomerId { get; set; }
//         public DateTime? StartAt { get; set; }
//         public DateTime? EndAt { get; set; }
//         public string? Title { get; set; }
//         public string? Content { get; set; }
//         public string? Staff { get; set; }
//         public string? Location { get; set; }
//         public string? Status { get; set; }
//     }

// // =========================
//     // DELETE /api/reservations/{id}
//     // =========================
//     [HttpDelete("reservations/{id:int}")]
//     public async Task<IActionResult> Delete(int id)
//     {
//         if (id <= 0) return BadRequest("id 无效");

//         await using var conn = new MySqlConnection(GetConnStr());
//         await conn.OpenAsync();

//         const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
//         try
//         {
//             var rows = await conn.ExecuteAsync(sql, new { Id = id });
//             return rows > 0 ? Ok() : NotFound();
//         }
//         catch (MySqlException ex)
//         {
//             return BadRequest(ex.Message);
//         }
//     }
// }

























// // using Dapper;
// // using Microsoft.AspNetCore.Mvc;
// // using MySqlConnector;
// // using crm_api.Models;

// // namespace crm_api.Controllers;

// // /// <summary>
// // /// Calendar / Reservations（预约/日程）
// // /// 基于 tb_customer_reservation
// // ///
// // /// ✅ 你之前 GET /api/reservations 返回 400（text/plain），说明字段命名不匹配。
// // /// 本版扩大字段候选范围，并在仍不匹配时把真实列名吐出来，方便一次性精确适配。
// // ///
// // /// ✅ 同时修复编译错误：你的 PagedResult 是 record/带构造函数（Items, Total），必须用构造器 new PagedResult(items, total)。
// // /// </summary>
// // [ApiController]
// // [Route("api")]
// // public class ReservationsController : ControllerBase
// // {
// //     private readonly IConfiguration _configuration;

// //     public ReservationsController(IConfiguration configuration)
// //     {
// //         _configuration = configuration;
// //     }

// //     private string GetConnStr()
// //     {
// //         var connStr = _configuration.GetConnectionString("CrmDb");
// //         if (string.IsNullOrWhiteSpace(connStr))
// //             throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
// //         return connStr;
// //     }

// //     // =========================
// //     // DTO / Request
// //     // =========================
// //     public class ReservationDto
// //     {
// //         public int Id { get; set; }
// //         public int CustomerId { get; set; }
// //         public string? CustomerName { get; set; }

// //         public DateTime? StartAt { get; set; }
// //         public DateTime? EndAt { get; set; }

// //         public string? Title { get; set; }
// //         public string? Content { get; set; }

// //         public string? Staff { get; set; }
// //         public string? Location { get; set; }

// //         public string? Status { get; set; }
// //         public DateTime? CreatedAt { get; set; }
// //     }

// //     public class CreateReservationRequest
// //     {
// //         public int CustomerId { get; set; }

// //         public DateTime? StartAt { get; set; }
// //         public DateTime? EndAt { get; set; }

// //         public string? Title { get; set; }
// //         public string? Content { get; set; }

// //         public string? Staff { get; set; }
// //         public string? Location { get; set; }

// //         public string? Status { get; set; }
// //     }

// //     // =========================
// //     // Schema helpers (adaptive columns)
// //     // =========================
// //     private static string? PickColumn(HashSet<string> cols, params string[] candidates)
// //     {
// //         foreach (var c in candidates)
// //         {
// //             if (cols.Contains(c)) return c;
// //         }
// //         return null;
// //     }

// //     private static string Q(string col) => $"`{col}`"; // MySQL identifier quoting

// //     private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
// //     {
// //         const string sql = @"
// // SELECT COLUMN_NAME
// // FROM information_schema.COLUMNS
// // WHERE TABLE_SCHEMA = DATABASE()
// //   AND TABLE_NAME = 'tb_customer_reservation';";

// //         var names = await conn.QueryAsync<string>(sql);
// //         return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
// //                     .Where(x => x.Length > 0)
// //                     .ToHashSet();
// //     }

// //     private class ReservationSchema
// //     {
// //         public string Table => "tb_customer_reservation";

// //         public string? CustomerIdCol { get; set; }
// //         public string? StartCol { get; set; }
// //         public string? EndCol { get; set; }
// //         public string? TitleCol { get; set; }
// //         public string? ContentCol { get; set; }
// //         public string? StaffCol { get; set; }
// //         public string? LocationCol { get; set; }
// //         public string? StatusCol { get; set; }
// //         public string? CreatedAtCol { get; set; }

// //         public string OrderCol => StartCol ?? CreatedAtCol ?? "id";
// //     }

// //     private ReservationSchema BuildSchema(HashSet<string> cols)
// //     {
// //         // NOTE: cols 已经 lower 过
// //         var schema = new ReservationSchema
// //         {
// //             // ✅ 扩大 customerId 候选范围
// //             CustomerIdCol = PickColumn(cols,
// //                 "customer_id", "customerid",
// //                 "customer_information_id", "customer_informationid",
// //                 "customer_info_id", "customerinfoid",
// //                 "customer_fk", "customerid_fk", "customer_ref", "customer_ref_id",
// //                 "cid", "customer"
// //             ),

// //             // ✅ 时间字段候选
// //             StartCol = PickColumn(cols,
// //                 "reservation_time", "reservation_at",
// //                 "reservation_datetime", "reservation_date_time",
// //                 "reservation_date", "reservation_dt",
// //                 "start_time", "start_at", "start_datetime", "start_date_time",
// //                 "begin_time", "begin_at",
// //                 "time", "datetime", "date_time"
// //             ),
// //             EndCol = PickColumn(cols,
// //                 "end_time", "end_at", "end_datetime", "end_date_time",
// //                 "finish_time", "finish_at", "to_time", "to_at"
// //             ),

// //             TitleCol = PickColumn(cols, "title", "theme", "subject", "name"),
// //             ContentCol = PickColumn(cols, "content", "note", "notes", "remark", "description"),
// //             StaffCol = PickColumn(cols, "staff", "owner", "operator", "assigned_to"),
// //             LocationCol = PickColumn(cols, "location", "address", "place"),
// //             StatusCol = PickColumn(cols, "status", "state"),
// //             CreatedAtCol = PickColumn(cols, "created_at", "create_time", "created_time", "createdon")
// //         };

// //         return schema;
// //     }

// //     private static string DumpCols(HashSet<string> cols)
// //         => string.Join(", ", cols.OrderBy(x => x));

// //     // =========================
// //     // GET /api/reservations
// //     // =========================
// //     [HttpGet("reservations")]
// //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// //     public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
// //         [FromQuery] int page = 1,
// //         [FromQuery] int pageSize = 20,
// //         [FromQuery] int? customerId = null,
// //         [FromQuery] DateTime? from = null,
// //         [FromQuery] DateTime? to = null,
// //         [FromQuery] string? keyword = null
// //     )
// //     {
// //         page = page < 1 ? 1 : page;
// //         pageSize = pageSize < 1 ? 20 : pageSize;
// //         pageSize = pageSize > 200 ? 200 : pageSize;
// //         var offset = (page - 1) * pageSize;

// //         keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

// //         await using var conn = new MySqlConnection(GetConnStr());
// //         await conn.OpenAsync();

// //         var cols = await GetReservationColumnsAsync(conn);
// //         var schema = BuildSchema(cols);

// //         if (schema.CustomerIdCol is null)
// //         {
// //             return BadRequest(
// //                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
// //                 "我已尝试候选：customer_id / customer_information_id / customer_fk 等。\n" +
// //                 "请把下面列名发我（或直接截图这个 400 Response），我会立刻精确适配：\n" +
// //                 DumpCols(cols)
// //             );
// //         }

// //         // build where
// //         var where = "WHERE 1=1 ";
// //         var p = new DynamicParameters();
// //         p.Add("@customerId", customerId);
// //         p.Add("@from", from);
// //         p.Add("@to", to);
// //         p.Add("@keyword", keyword);
// //         p.Add("@pageSize", pageSize);
// //         p.Add("@offset", offset);

// //         where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

// //         // time range filter: use start col if exists, otherwise created_at
// //         var timeCol = schema.StartCol ?? schema.CreatedAtCol;
// //         if (timeCol is not null)
// //         {
// //             where += $" AND (@from IS NULL OR r.{Q(timeCol)} >= @from) ";
// //             where += $" AND (@to IS NULL OR r.{Q(timeCol)} <= @to) ";
// //         }

// //         // keyword filter (best effort)
// //         var kwParts = new List<string>();
// //         if (schema.TitleCol is not null) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
// //         if (schema.ContentCol is not null) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
// //         if (schema.StaffCol is not null) kwParts.Add($"r.{Q(schema.StaffCol)} LIKE CONCAT('%', @keyword, '%')");
// //         if (schema.LocationCol is not null) kwParts.Add($"r.{Q(schema.LocationCol)} LIKE CONCAT('%', @keyword, '%')");
// //         // customer name 依赖 tb_customer_information 的 name
// //         kwParts.Add($"c.name LIKE CONCAT('%', @keyword, '%')");

// //         where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

// //         // SELECT with safe aliases
// //         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

// //         var countSql = $@"
// // SELECT COUNT(1)
// // FROM {schema.Table} r
// // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // {where};
// // ";

// //         var listSql = $@"
// // SELECT
// //   r.id AS Id,
// //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// //   c.name AS CustomerName,
// //   {SelCol(schema.StartCol, "StartAt")},
// //   {SelCol(schema.EndCol, "EndAt")},
// //   {SelCol(schema.TitleCol, "Title")},
// //   {SelCol(schema.ContentCol, "Content")},
// //   {SelCol(schema.StaffCol, "Staff")},
// //   {SelCol(schema.LocationCol, "Location")},
// //   {SelCol(schema.StatusCol, "Status")},
// //   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// // FROM {schema.Table} r
// // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // {where}
// // ORDER BY r.{Q(schema.OrderCol)} DESC, r.id DESC
// // LIMIT @pageSize OFFSET @offset;
// // ";

// //         var total = await conn.ExecuteScalarAsync<long>(countSql, p);
// //         var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

// //         // ✅ 你的 PagedResult 是 record/有构造器：PagedResult(IReadOnlyList<T> Items, long Total)
// //         return Ok(new PagedResult<ReservationDto>(items, total));
// //     }

// //     // =========================
// //     // GET /api/customers/{id}/reservations
// //     // =========================
// //     [HttpGet("customers/{customerId:int}/reservations")]
// //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// //     public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
// //         int customerId,
// //         [FromQuery] int page = 1,
// //         [FromQuery] int pageSize = 20,
// //         [FromQuery] DateTime? from = null,
// //         [FromQuery] DateTime? to = null,
// //         [FromQuery] string? keyword = null
// //     )
// //     {
// //         return GetReservations(page, pageSize, customerId, from, to, keyword);
// //     }

    
// //     // =========================
// //     // 冲突检测（后端最终拦截）
// //     // =========================
// //     private static DateTime NormalizeEnd(DateTime start, DateTime? end) => end ?? start;

// //     private static bool IsOverlapping(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd)
// //         => aStart < bEnd && aEnd > bStart; // 严格不等：允许 end == start 不算冲突

// //     private async Task<ReservationDto?> FindConflictAsync(
// //         MySqlConnection conn,
// //         ReservationSchema schema,
// //         int? excludeId,
// //         string staff,
// //         DateTime startAt,
// //         DateTime? endAt
// //     )
// //     {
// //         if (string.IsNullOrWhiteSpace(staff)) return null;
// //         if (schema.StaffCol is null) return null;

// //         var startCol = schema.StartCol ?? schema.CreatedAtCol;
// //         if (startCol is null) return null; // 没有时间字段，无法检测

// //         var endCol = schema.EndCol; // 允许为空

// //         // ✅ 使用 COALESCE(end, start) 处理 end 为空的情况
// //         var staffCol = Q(schema.StaffCol);
// //         var sCol = Q(startCol);
// //         var eExpr = endCol is null ? $"r.{sCol}" : $"COALESCE(r.{Q(endCol)}, r.{sCol})";

// //         // ✅ 后端最终冲突检测：同一 Staff 时间段不能重叠
// //         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
// //         {
// //             var conflict = await FindConflictAsync(conn, schema, excludeId: null, staff: req.Staff!.Trim(), startAt: req.StartAt!.Value, endAt: req.EndAt);
// //             if (conflict is not null)
// //             {
// //                 return StatusCode(StatusCodes.Status409Conflict,
// //                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
// //             }
// //         }

// //         var sql = $@"
// // SELECT
// //   r.id AS Id,
// //   r.{Q(schema.CustomerIdCol!)} AS CustomerId,
// //   c.name AS CustomerName,
// //   r.{sCol} AS StartAt,
// //   {(endCol is null ? "NULL" : $"r.{Q(endCol)}")} AS EndAt,
// //   {(schema.TitleCol is null ? "NULL" : $"r.{Q(schema.TitleCol)}")} AS Title,
// //   {(schema.ContentCol is null ? "NULL" : $"r.{Q(schema.ContentCol)}")} AS Content,
// //   {(schema.StaffCol is null ? "NULL" : $"r.{Q(schema.StaffCol)}")} AS Staff,
// //   {(schema.LocationCol is null ? "NULL" : $"r.{Q(schema.LocationCol)}")} AS Location,
// //   {(schema.StatusCol is null ? "NULL" : $"r.{Q(schema.StatusCol)}")} AS Status,
// //   {(schema.CreatedAtCol is null ? "NULL" : $"r.{Q(schema.CreatedAtCol)}")} AS CreatedAt
// // FROM {schema.Table} r
// // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol!)} = c.id
// // WHERE r.{staffCol} = @Staff
// //   {(excludeId is null ? "" : "AND r.id <> @ExcludeId")}
// //   AND r.{sCol} < @NewEnd
// //   AND {eExpr} > @NewStart
// // ORDER BY r.{sCol} ASC
// // LIMIT 1;
// // ";
// //         var p = new DynamicParameters();
// //         p.Add("@Staff", staff.Trim());
// //         if (excludeId is not null) p.Add("@ExcludeId", excludeId.Value);

// //         var newStart = startAt;
// //         var newEnd = NormalizeEnd(startAt, endAt);
// //         p.Add("@NewStart", newStart);
// //         p.Add("@NewEnd", newEnd);

// //         return await conn.QueryFirstOrDefaultAsync<ReservationDto>(sql, p);
// //     }

// // // =========================
// //     // POST /api/reservations
// //     // =========================
// //     [HttpPost("reservations")]
// //     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
// //     public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
// //     {
// //         if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
// //         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

// //         await using var conn = new MySqlConnection(GetConnStr());
// //         await conn.OpenAsync();

// //         var cols = await GetReservationColumnsAsync(conn);
// //         var schema = BuildSchema(cols);

// //         if (schema.CustomerIdCol is null)
// //         {
// //             return BadRequest(
// //                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
// //                 "当前列名：\n" + DumpCols(cols)
// //             );
// //         }

// //         // choose a time col to insert
// //         var startCol = schema.StartCol ?? schema.CreatedAtCol;
// //         if (startCol is null)
// //             return BadRequest("tb_customer_reservation 没有可用的时间字段（reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

// //         var insertCols = new List<string> { Q(schema.CustomerIdCol), Q(startCol) };
// //         var insertVals = new List<string> { "@CustomerId", "@StartAt" };

// //         var p = new DynamicParameters();
// //         p.Add("@CustomerId", req.CustomerId);
// //         p.Add("@StartAt", req.StartAt);

// //         if (schema.EndCol is not null && req.EndAt is not null)
// //         {
// //             insertCols.Add(Q(schema.EndCol));
// //             insertVals.Add("@EndAt");
// //             p.Add("@EndAt", req.EndAt);
// //         }

// //         if (schema.TitleCol is not null && !string.IsNullOrWhiteSpace(req.Title))
// //         {
// //             insertCols.Add(Q(schema.TitleCol));
// //             insertVals.Add("@Title");
// //             p.Add("@Title", req.Title!.Trim());
// //         }

// //         if (schema.ContentCol is not null && !string.IsNullOrWhiteSpace(req.Content))
// //         {
// //             insertCols.Add(Q(schema.ContentCol));
// //             insertVals.Add("@Content");
// //             p.Add("@Content", req.Content!.Trim());
// //         }

// //         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
// //         {
// //             insertCols.Add(Q(schema.StaffCol));
// //             insertVals.Add("@Staff");
// //             p.Add("@Staff", req.Staff!.Trim());
// //         }

// //         if (schema.LocationCol is not null && !string.IsNullOrWhiteSpace(req.Location))
// //         {
// //             insertCols.Add(Q(schema.LocationCol));
// //             insertVals.Add("@Location");
// //             p.Add("@Location", req.Location!.Trim());
// //         }

// //         if (schema.StatusCol is not null && !string.IsNullOrWhiteSpace(req.Status))
// //         {
// //             insertCols.Add(Q(schema.StatusCol));
// //             insertVals.Add("@Status");
// //             p.Add("@Status", req.Status!.Trim());
// //         }

// //         // if created_at exists and is different from startCol, set NOW()
// //         if (schema.CreatedAtCol is not null && schema.CreatedAtCol != startCol)
// //         {
// //             insertCols.Add(Q(schema.CreatedAtCol));
// //             insertVals.Add("NOW()");
// //         }

// //         var sql = $@"
// // INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
// // VALUES ({string.Join(", ", insertVals)});
// // SELECT LAST_INSERT_ID();
// // ";

// //         int newId;
// //         try
// //         {
// //             newId = await conn.ExecuteScalarAsync<int>(sql, p);
// //         }
// //         catch (MySqlException ex)
// //         {
// //             return BadRequest($"创建预约失败：{ex.Message}");
// //         }

// //         // read back
// //         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

// //         var getSql = $@"
// // SELECT
// //   r.id AS Id,
// //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// //   c.name AS CustomerName,
// //   {SelCol(schema.StartCol, "StartAt")},
// //   {SelCol(schema.EndCol, "EndAt")},
// //   {SelCol(schema.TitleCol, "Title")},
// //   {SelCol(schema.ContentCol, "Content")},
// //   {SelCol(schema.StaffCol, "Staff")},
// //   {SelCol(schema.LocationCol, "Location")},
// //   {SelCol(schema.StatusCol, "Status")},
// //   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// // FROM {schema.Table} r
// // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // WHERE r.id = @Id
// // LIMIT 1;
// // ";
// //         var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
// //         return Ok(created ?? new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });
// //     }

    
// //     // =========================
// //     // PUT /api/reservations/{id}
// //     // 用于拖拽/拉伸/抽屉编辑保存
// //     // =========================
// //     [HttpPut("reservations/{id:int}")]
// //     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
// //     public async Task<ActionResult<ReservationDto>> Update(int id, [FromBody] UpdateReservationRequest req)
// //     {
// //         if (id <= 0) return BadRequest("id 无效");
// //         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

// //         await using var conn = new MySqlConnection(GetConnStr());
// //         await conn.OpenAsync();

// //         var cols = await GetReservationColumnsAsync(conn);
// //         var schema = BuildSchema(cols);

// //         if (schema.CustomerIdCol is null)
// //         {
// //             return BadRequest(
// //                 "tb_customer_reservation 缺少可识别的 CustomerId 字段。\n" +
// //                 "当前列名：\n" + DumpCols(cols)
// //             );
// //         }

// //         var startCol = schema.StartCol ?? schema.CreatedAtCol;
// //         if (startCol is null)
// //             return BadRequest("tb_customer_reservation 没有可用的时间字段（reservation_time/start_time/created_at 等）。当前列名：\n" + DumpCols(cols));

// //         // ✅ 后端最终冲突检测：同一 Staff 时间段不能重叠
// //         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
// //         {
// //             var conflict = await FindConflictAsync(conn, schema, excludeId: id, staff: req.Staff!.Trim(), startAt: req.StartAt!.Value, endAt: req.EndAt);
// //             if (conflict is not null)
// //             {
// //                 return StatusCode(StatusCodes.Status409Conflict,
// //                     new { message = $"时间冲突：{req.Staff!.Trim()} 在 {conflict.StartAt:yyyy-MM-dd HH:mm} 已有预约（ID #{conflict.Id}）" });
// //             }
// //         }

// //         var sets = new List<string>();
// //         var p = new DynamicParameters();
// //         p.Add("@Id", id);

// //         // CustomerId（可选）
// //         if (req.CustomerId is not null && req.CustomerId.Value > 0)
// //         {
// //             sets.Add($"{Q(schema.CustomerIdCol)} = @CustomerId");
// //             p.Add("@CustomerId", req.CustomerId.Value);
// //         }

// //         // StartAt/EndAt
// //         sets.Add($"{Q(startCol)} = @StartAt");
// //         p.Add("@StartAt", req.StartAt);

// //         if (schema.EndCol is not null)
// //         {
// //             sets.Add($"{Q(schema.EndCol)} = @EndAt");
// //             p.Add("@EndAt", req.EndAt);
// //         }

// //         // Title/Content/Staff/Location/Status
// //         if (schema.TitleCol is not null)
// //         {
// //             sets.Add($"{Q(schema.TitleCol)} = @Title");
// //             p.Add("@Title", string.IsNullOrWhiteSpace(req.Title) ? null : req.Title!.Trim());
// //         }

// //         if (schema.ContentCol is not null)
// //         {
// //             sets.Add($"{Q(schema.ContentCol)} = @Content");
// //             p.Add("@Content", string.IsNullOrWhiteSpace(req.Content) ? null : req.Content!.Trim());
// //         }

// //         if (schema.StaffCol is not null)
// //         {
// //             sets.Add($"{Q(schema.StaffCol)} = @Staff");
// //             p.Add("@Staff", string.IsNullOrWhiteSpace(req.Staff) ? null : req.Staff!.Trim());
// //         }

// //         if (schema.LocationCol is not null)
// //         {
// //             sets.Add($"{Q(schema.LocationCol)} = @Location");
// //             p.Add("@Location", string.IsNullOrWhiteSpace(req.Location) ? null : req.Location!.Trim());
// //         }

// //         if (schema.StatusCol is not null)
// //         {
// //             sets.Add($"{Q(schema.StatusCol)} = @Status");
// //             p.Add("@Status", string.IsNullOrWhiteSpace(req.Status) ? null : req.Status!.Trim());
// //         }

// //         if (sets.Count == 0) return BadRequest("没有可更新字段");

// //         var sql = $@"UPDATE {schema.Table} SET {string.Join(", ", sets)} WHERE id = @Id;";
// //         try
// //         {
// //             var rows = await conn.ExecuteAsync(sql, p);
// //             if (rows <= 0) return NotFound();
// //         }
// //         catch (MySqlException ex)
// //         {
// //             return BadRequest($"更新预约失败：{ex.Message}");
// //         }

// //         // read back
// //         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

// //         var getSql = $@"
// // SELECT
// //   r.id AS Id,
// //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// //   c.name AS CustomerName,
// //   {SelCol(schema.StartCol, "StartAt")},
// //   {SelCol(schema.EndCol, "EndAt")},
// //   {SelCol(schema.TitleCol, "Title")},
// //   {SelCol(schema.ContentCol, "Content")},
// //   {SelCol(schema.StaffCol, "Staff")},
// //   {SelCol(schema.LocationCol, "Location")},
// //   {SelCol(schema.StatusCol, "Status")},
// //   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// // FROM {schema.Table} r
// // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // WHERE r.id = @Id
// // LIMIT 1;
// // ";
// //         var updated = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = id });
// //         return Ok(updated ?? new ReservationDto { Id = id });
// //     }

// //     public class UpdateReservationRequest
// //     {
// //         public int? CustomerId { get; set; }
// //         public DateTime? StartAt { get; set; }
// //         public DateTime? EndAt { get; set; }
// //         public string? Title { get; set; }
// //         public string? Content { get; set; }
// //         public string? Staff { get; set; }
// //         public string? Location { get; set; }
// //         public string? Status { get; set; }
// //     }

// // // =========================
// //     // DELETE /api/reservations/{id}
// //     // =========================
// //     [HttpDelete("reservations/{id:int}")]
// //     public async Task<IActionResult> Delete(int id)
// //     {
// //         if (id <= 0) return BadRequest("id 无效");

// //         await using var conn = new MySqlConnection(GetConnStr());
// //         await conn.OpenAsync();

// //         const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
// //         try
// //         {
// //             var rows = await conn.ExecuteAsync(sql, new { Id = id });
// //             return rows > 0 ? Ok() : NotFound();
// //         }
// //         catch (MySqlException ex)
// //         {
// //             return BadRequest(ex.Message);
// //         }
// //     }
// // }




















// // // using Dapper;
// // // using Microsoft.AspNetCore.Mvc;
// // // using MySqlConnector;
// // // using crm_api.Models;

// // // namespace crm_api.Controllers;

// // // [ApiController]
// // // [Route("api")]
// // // public class ReservationsController : ControllerBase
// // // {
// // //     private readonly IConfiguration _configuration;

// // //     public ReservationsController(IConfiguration configuration)
// // //     {
// // //         _configuration = configuration;
// // //     }

// // //     private string GetConnStr()
// // //     {
// // //         var connStr = _configuration.GetConnectionString("CrmDb");
// // //         if (string.IsNullOrWhiteSpace(connStr))
// // //             throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
// // //         return connStr;
// // //     }

// // //     // =========================
// // //     // DTO / Request
// // //     // =========================
// // //     public class ReservationDto
// // //     {
// // //         public int Id { get; set; }
// // //         public int CustomerId { get; set; }
// // //         public string? CustomerName { get; set; }

// // //         public DateTime? StartAt { get; set; }
// // //         public DateTime? EndAt { get; set; }

// // //         public string? Title { get; set; }
// // //         public string? Content { get; set; }

// // //         public string? Staff { get; set; }
// // //         public string? Location { get; set; }

// // //         public string? Status { get; set; }
// // //         public DateTime? CreatedAt { get; set; }
// // //     }

// // //     public class CreateReservationRequest
// // //     {
// // //         public int CustomerId { get; set; } // 前端仍传 customerId
// // //         public DateTime? StartAt { get; set; } // -> registration_time
// // //         public DateTime? EndAt { get; set; }   // 你表里没有 end 字段，这里先不写入

// // //         public string? Title { get; set; }     // -> reservation_theme
// // //         public string? Content { get; set; }   // -> reservation_content

// // //         public string? Staff { get; set; }     // 你表里是 customer_representative_id（可能是数字ID）
// // //         public string? Location { get; set; }  // 你表里暂未看到 location 字段
// // //         public string? Status { get; set; }    // 你表里暂未看到 status 字段
// // //     }

// // //     // =========================
// // //     // Schema helpers
// // //     // =========================
// // //     private static string Q(string col) => $"`{col}`";

// // //     private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
// // //     {
// // //         const string sql = @"
// // // SELECT COLUMN_NAME
// // // FROM information_schema.COLUMNS
// // // WHERE TABLE_SCHEMA = DATABASE()
// // //   AND TABLE_NAME = 'tb_customer_reservation';";

// // //         var names = await conn.QueryAsync<string>(sql);
// // //         return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
// // //                     .Where(x => x.Length > 0)
// // //                     .ToHashSet();
// // //     }

// // //     private static string DumpCols(HashSet<string> cols)
// // //         => string.Join(", ", cols.OrderBy(x => x));

// // //     // =========================
// // //     // ✅ 你表的字段精确映射（基于你 400 Response 列名）
// // //     // =========================
// // //     private class ReservationSchema
// // //     {
// // //         public string Table => "tb_customer_reservation";

// // //         // ✅ 你表里真正的“客户外键”字段
// // //         public string CustomerIdCol => "customer_name_id";

// // //         // ✅ 预约时间字段
// // //         public string StartCol => "registration_time";

// // //         // ✅ 标题/主题
// // //         public string TitleCol => "reservation_theme";

// // //         // ✅ 内容/备注
// // //         public string ContentCol => "reservation_content";

// // //         // 可选：提醒时间
// // //         public string? ReminderCol => "reminder_time";

// // //         // 可选：预约方式
// // //         public string? MethodCol => "reservation_method";

// // //         // 可选：负责人（你表里是一个 *_id）
// // //         public string? RepresentativeIdCol => "customer_representative_id";
// // //     }

// // //     private async Task<ReservationSchema> EnsureSchemaAsync(MySqlConnection conn)
// // //     {
// // //         var cols = await GetReservationColumnsAsync(conn);

// // //         // 最核心：customer_name_id 必须存在
// // //         if (!cols.Contains("customer_name_id"))
// // //         {
// // //             return null!;
// // //         }

// // //         // registration_time / reservation_theme / reservation_content 也最好存在
// // //         // 如果缺少，我们仍然返回，但会尽量让 API 跑起来
// // //         return new ReservationSchema();
// // //     }

// // //     // =========================
// // //     // GET /api/reservations
// // //     // =========================
// // //     [HttpGet("reservations")]
// // //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// // //     public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
// // //         [FromQuery] int page = 1,
// // //         [FromQuery] int pageSize = 20,
// // //         [FromQuery] int? customerId = null,
// // //         [FromQuery] DateTime? from = null,
// // //         [FromQuery] DateTime? to = null,
// // //         [FromQuery] string? keyword = null
// // //     )
// // //     {
// // //         page = page < 1 ? 1 : page;
// // //         pageSize = pageSize < 1 ? 20 : pageSize;
// // //         pageSize = pageSize > 200 ? 200 : pageSize;
// // //         var offset = (page - 1) * pageSize;

// // //         keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         var cols = await GetReservationColumnsAsync(conn);
// // //         if (!cols.Contains("customer_name_id"))
// // //         {
// // //             return BadRequest(
// // //                 "tb_customer_reservation 缺少 customer_name_id（客户关联字段）。当前列名：\n" + DumpCols(cols)
// // //             );
// // //         }

// // //         // ✅ 使用你表的字段
// // //         var schema = new ReservationSchema();

// // //         // where
// // //         var where = "WHERE 1=1 ";
// // //         var p = new DynamicParameters();
// // //         p.Add("@customerId", customerId);
// // //         p.Add("@from", from);
// // //         p.Add("@to", to);
// // //         p.Add("@keyword", keyword);
// // //         p.Add("@pageSize", pageSize);
// // //         p.Add("@offset", offset);

// // //         where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

// // //         // 时间范围（registration_time）
// // //         if (cols.Contains(schema.StartCol))
// // //         {
// // //             where += $" AND (@from IS NULL OR r.{Q(schema.StartCol)} >= @from) ";
// // //             where += $" AND (@to IS NULL OR r.{Q(schema.StartCol)} <= @to) ";
// // //         }

// // //         // keyword（主题/内容/方式 + 客户名）
// // //         var kwParts = new List<string>();
// // //         if (cols.Contains(schema.TitleCol)) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         if (cols.Contains(schema.ContentCol)) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         if (schema.MethodCol is not null && cols.Contains(schema.MethodCol))
// // //             kwParts.Add($"r.{Q(schema.MethodCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         kwParts.Add("c.name LIKE CONCAT('%', @keyword, '%')");

// // //         where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

// // //         // count
// // //         var countSql = $@"
// // // SELECT COUNT(1)
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // {where};
// // // ";

// // //         // list
// // //         // 注意：你表里没有 end/location/status 字段，我们先输出 NULL
// // //         var listSql = $@"
// // // SELECT
// // //   r.id AS Id,
// // //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// // //   c.name AS CustomerName,
// // //   {(cols.Contains(schema.StartCol) ? $"r.{Q(schema.StartCol)}" : "NULL")} AS StartAt,
// // //   NULL AS EndAt,
// // //   {(cols.Contains(schema.TitleCol) ? $"r.{Q(schema.TitleCol)}" : "NULL")} AS Title,
// // //   {(cols.Contains(schema.ContentCol) ? $"r.{Q(schema.ContentCol)}" : "NULL")} AS Content,
// // //   {(schema.RepresentativeIdCol is not null && cols.Contains(schema.RepresentativeIdCol) ? $"CAST(r.{Q(schema.RepresentativeIdCol)} AS CHAR)" : "NULL")} AS Staff,
// // //   NULL AS Location,
// // //   NULL AS Status,
// // //   {(cols.Contains(schema.StartCol) ? $"r.{Q(schema.StartCol)}" : "NULL")} AS CreatedAt
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // {where}
// // // ORDER BY r.id DESC
// // // LIMIT @pageSize OFFSET @offset;
// // // ";

// // //         var total = await conn.ExecuteScalarAsync<long>(countSql, p);
// // //         var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

// // //         // ✅ 你的 PagedResult 构造器：PagedResult(IReadOnlyList<T> Items, long Total)
// // //         return Ok(new PagedResult<ReservationDto>(items, total));
// // //     }

// // //     // =========================
// // //     // GET /api/customers/{id}/reservations
// // //     // =========================
// // //     [HttpGet("customers/{customerId:int}/reservations")]
// // //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// // //     public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
// // //         int customerId,
// // //         [FromQuery] int page = 1,
// // //         [FromQuery] int pageSize = 20,
// // //         [FromQuery] DateTime? from = null,
// // //         [FromQuery] DateTime? to = null,
// // //         [FromQuery] string? keyword = null
// // //     )
// // //     {
// // //         return GetReservations(page, pageSize, customerId, from, to, keyword);
// // //     }

// // //     // =========================
// // //     // POST /api/reservations
// // //     // =========================
// // //     [HttpPost("reservations")]
// // //     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
// // //     public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
// // //     {
// // //         if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
// // //         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         var cols = await GetReservationColumnsAsync(conn);
// // //         if (!cols.Contains("customer_name_id"))
// // //         {
// // //             return BadRequest("tb_customer_reservation 缺少 customer_name_id。当前列名：\n" + DumpCols(cols));
// // //         }

// // //         var schema = new ReservationSchema();

// // //         // ✅ 只插入你表确认存在的字段
// // //         var insertCols = new List<string> { Q(schema.CustomerIdCol) };
// // //         var insertVals = new List<string> { "@CustomerId" };

// // //         var p = new DynamicParameters();
// // //         p.Add("@CustomerId", req.CustomerId);

// // //         if (cols.Contains(schema.StartCol))
// // //         {
// // //             insertCols.Add(Q(schema.StartCol));
// // //             insertVals.Add("@StartAt");
// // //             p.Add("@StartAt", req.StartAt);
// // //         }
// // //         else
// // //         {
// // //             return BadRequest("tb_customer_reservation 缺少 registration_time。当前列名：\n" + DumpCols(cols));
// // //         }

// // //         if (cols.Contains(schema.TitleCol) && !string.IsNullOrWhiteSpace(req.Title))
// // //         {
// // //             insertCols.Add(Q(schema.TitleCol));
// // //             insertVals.Add("@Title");
// // //             p.Add("@Title", req.Title!.Trim());
// // //         }

// // //         if (cols.Contains(schema.ContentCol) && !string.IsNullOrWhiteSpace(req.Content))
// // //         {
// // //             insertCols.Add(Q(schema.ContentCol));
// // //             insertVals.Add("@Content");
// // //             p.Add("@Content", req.Content!.Trim());
// // //         }

// // //         // 如果你想把 Staff 写入 customer_representative_id（数字），可以让前端传数字字符串
// // //         if (schema.RepresentativeIdCol is not null && cols.Contains(schema.RepresentativeIdCol) && !string.IsNullOrWhiteSpace(req.Staff))
// // //         {
// // //             if (int.TryParse(req.Staff.Trim(), out var repId))
// // //             {
// // //                 insertCols.Add(Q(schema.RepresentativeIdCol));
// // //                 insertVals.Add("@RepId");
// // //                 p.Add("@RepId", repId);
// // //             }
// // //         }

// // //         var sql = $@"
// // // INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
// // // VALUES ({string.Join(", ", insertVals)});
// // // SELECT LAST_INSERT_ID();
// // // ";

// // //         int newId;
// // //         try
// // //         {
// // //             newId = await conn.ExecuteScalarAsync<int>(sql, p);
// // //         }
// // //         catch (MySqlException ex)
// // //         {
// // //             return BadRequest($"创建预约失败：{ex.Message}");
// // //         }

// // //         // read back
// // //         var getSql = $@"
// // // SELECT
// // //   r.id AS Id,
// // //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// // //   c.name AS CustomerName,
// // //   r.{Q(schema.StartCol)} AS StartAt,
// // //   NULL AS EndAt,
// // //   {(cols.Contains(schema.TitleCol) ? $"r.{Q(schema.TitleCol)}" : "NULL")} AS Title,
// // //   {(cols.Contains(schema.ContentCol) ? $"r.{Q(schema.ContentCol)}" : "NULL")} AS Content,
// // //   {(schema.RepresentativeIdCol is not null && cols.Contains(schema.RepresentativeIdCol) ? $"CAST(r.{Q(schema.RepresentativeIdCol)} AS CHAR)" : "NULL")} AS Staff,
// // //   NULL AS Location,
// // //   NULL AS Status,
// // //   r.{Q(schema.StartCol)} AS CreatedAt
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // WHERE r.id = @Id
// // // LIMIT 1;
// // // ";

// // //         var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
// // //         return Ok(created ?? new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });
// // //     }

// // //     // =========================
// // //     // DELETE /api/reservations/{id}
// // //     // =========================
// // //     [HttpDelete("reservations/{id:int}")]
// // //     public async Task<IActionResult> Delete(int id)
// // //     {
// // //         if (id <= 0) return BadRequest("id 无效");

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
// // //         try
// // //         {
// // //             var rows = await conn.ExecuteAsync(sql, new { Id = id });
// // //             return rows > 0 ? Ok() : NotFound();
// // //         }
// // //         catch (MySqlException ex)
// // //         {
// // //             return BadRequest(ex.Message);
// // //         }
// // //     }
// // // }










// // ////// using Dapper;
// // // using Microsoft.AspNetCore.Mvc;
// // // using MySqlConnector;

// // // using crm_api.Models;

// // // namespace crm_api.Controllers;

// // // /// <summary>
// // // /// Reservation / Calendar（预约/日程）
// // // /// - 基于现有表：tb_customer_reservation
// // // /// - 因为你当前没有提供 DDL（字段名未知），本 Controller 会先读取 information_schema 来“自适应”字段名：
// // // ///   * 时间字段：reservation_time / start_time / start_at / begin_time ...（按优先级挑一个）
// // // ///   * 结束时间字段：end_time / end_at / finish_time ...
// // // ///   * 标题字段：title / theme / subject / name ...
// // // ///   * 内容字段：content / note / notes / remark / description ...
// // // ///   * 人员字段：staff / owner / operator ...
// // // ///   * 地点字段：location / address ...
// // // ///
// // // /// ✅ 这样可以最大概率直接跑起来；如果你执行接口时报“Unknown column ...”，把错误截图给我，我会按你的真实字段名再做一次精确适配。
// // // /// </summary>
// // // [ApiController]
// // // [Route("api")]
// // // public class ReservationsController : ControllerBase
// // // {
// // //     private readonly IConfiguration _configuration;

// // //     public ReservationsController(IConfiguration configuration)
// // //     {
// // //         _configuration = configuration;
// // //     }

// // //     private string GetConnStr()
// // //     {
// // //         var connStr = _configuration.GetConnectionString("CrmDb");
// // //         if (string.IsNullOrWhiteSpace(connStr))
// // //             throw new InvalidOperationException("Connection string 'CrmDb' not found in appsettings.json");
// // //         return connStr;
// // //     }

// // //     // =========================
// // //     // DTO / Request
// // //     // =========================
// // //     public class ReservationDto
// // //     {
// // //         public int Id { get; set; }
// // //         public int CustomerId { get; set; }
// // //         public string? CustomerName { get; set; }

// // //         public DateTime? StartAt { get; set; }
// // //         public DateTime? EndAt { get; set; }

// // //         public string? Title { get; set; }
// // //         public string? Content { get; set; }

// // //         public string? Staff { get; set; }
// // //         public string? Location { get; set; }

// // //         public string? Status { get; set; }
// // //         public DateTime? CreatedAt { get; set; }
// // //     }

// // //     public class CreateReservationRequest
// // //     {
// // //         public int CustomerId { get; set; }

// // //         public DateTime? StartAt { get; set; }
// // //         public DateTime? EndAt { get; set; }

// // //         public string? Title { get; set; }
// // //         public string? Content { get; set; }

// // //         public string? Staff { get; set; }
// // //         public string? Location { get; set; }

// // //         public string? Status { get; set; }
// // //     }

// // //     // =========================
// // //     // Schema helpers (adaptive columns)
// // //     // =========================
// // //     private static string? PickColumn(HashSet<string> cols, params string[] candidates)
// // //     {
// // //         foreach (var c in candidates)
// // //         {
// // //             if (cols.Contains(c)) return c;
// // //         }
// // //         return null;
// // //     }

// // //     private static string Q(string col) => $"`{col}`"; // MySQL identifier quoting

// // //     private async Task<HashSet<string>> GetReservationColumnsAsync(MySqlConnection conn)
// // //     {
// // //         const string sql = @"
// // // SELECT COLUMN_NAME
// // // FROM information_schema.COLUMNS
// // // WHERE TABLE_SCHEMA = DATABASE()
// // //   AND TABLE_NAME = 'tb_customer_reservation';";

// // //         var names = await conn.QueryAsync<string>(sql);
// // //         // Normalize to lower
// // //         return names.Select(x => (x ?? "").Trim().ToLowerInvariant())
// // //                     .Where(x => x.Length > 0)
// // //                     .ToHashSet();
// // //     }

// // //     private class ReservationSchema
// // //     {
// // //         public string Table => "tb_customer_reservation";

// // //         public string? CustomerIdCol { get; set; }
// // //         public string? StartCol { get; set; }
// // //         public string? EndCol { get; set; }
// // //         public string? TitleCol { get; set; }
// // //         public string? ContentCol { get; set; }
// // //         public string? StaffCol { get; set; }
// // //         public string? LocationCol { get; set; }
// // //         public string? StatusCol { get; set; }
// // //         public string? CreatedAtCol { get; set; }

// // //         public string OrderCol => StartCol ?? CreatedAtCol ?? "id";
// // //     }

// // //     private ReservationSchema BuildSchema(HashSet<string> cols)
// // //     {
// // //         // NOTE: table columns normalized to lower
// // //         var schema = new ReservationSchema
// // //         {
// // //             CustomerIdCol = PickColumn(cols, "customer_id", "customerid"),
// // //             StartCol = PickColumn(cols,
// // //                 "reservation_time", "reservation_at", "start_time", "start_at", "begin_time", "begin_at", "time", "datetime", "date_time"),
// // //             EndCol = PickColumn(cols,
// // //                 "end_time", "end_at", "finish_time", "finish_at", "to_time", "to_at"),
// // //             TitleCol = PickColumn(cols, "title", "theme", "subject", "name"),
// // //             ContentCol = PickColumn(cols, "content", "note", "notes", "remark", "description"),
// // //             StaffCol = PickColumn(cols, "staff", "owner", "operator", "assigned_to"),
// // //             LocationCol = PickColumn(cols, "location", "address", "place"),
// // //             StatusCol = PickColumn(cols, "status", "state"),
// // //             CreatedAtCol = PickColumn(cols, "created_at", "create_time", "created_time", "createdon")
// // //         };

// // //         return schema;
// // //     }

// // //     // =========================
// // //     // GET /api/reservations
// // //     // =========================
// // //     [HttpGet("reservations")]
// // //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// // //     public async Task<ActionResult<PagedResult<ReservationDto>>> GetReservations(
// // //         [FromQuery] int page = 1,
// // //         [FromQuery] int pageSize = 20,
// // //         [FromQuery] int? customerId = null,
// // //         [FromQuery] DateTime? from = null,
// // //         [FromQuery] DateTime? to = null,
// // //         [FromQuery] string? keyword = null
// // //     )
// // //     {
// // //         page = page < 1 ? 1 : page;
// // //         pageSize = pageSize < 1 ? 20 : pageSize;
// // //         pageSize = pageSize > 200 ? 200 : pageSize;
// // //         var offset = (page - 1) * pageSize;

// // //         keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         var cols = await GetReservationColumnsAsync(conn);
// // //         var schema = BuildSchema(cols);

// // //         if (schema.CustomerIdCol is null)
// // //             return BadRequest("tb_customer_reservation 缺少 customer_id 字段（或命名不同）。请把表结构（DDL）发我，我来精确适配。");

// // //         // build where
// // //         var where = "WHERE 1=1 ";
// // //         var p = new DynamicParameters();
// // //         p.Add("@customerId", customerId);
// // //         p.Add("@from", from);
// // //         p.Add("@to", to);
// // //         p.Add("@keyword", keyword);
// // //         p.Add("@pageSize", pageSize);
// // //         p.Add("@offset", offset);

// // //         where += $" AND (@customerId IS NULL OR r.{Q(schema.CustomerIdCol)} = @customerId) ";

// // //         // time range filter: use start col if exists, otherwise created_at
// // //         var timeCol = schema.StartCol ?? schema.CreatedAtCol;
// // //         if (timeCol is not null)
// // //         {
// // //             where += $" AND (@from IS NULL OR r.{Q(timeCol)} >= @from) ";
// // //             where += $" AND (@to IS NULL OR r.{Q(timeCol)} <= @to) ";
// // //         }

// // //         // keyword filter (best effort)
// // //         var kwParts = new List<string>();
// // //         if (schema.TitleCol is not null) kwParts.Add($"r.{Q(schema.TitleCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         if (schema.ContentCol is not null) kwParts.Add($"r.{Q(schema.ContentCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         if (schema.StaffCol is not null) kwParts.Add($"r.{Q(schema.StaffCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         if (schema.LocationCol is not null) kwParts.Add($"r.{Q(schema.LocationCol)} LIKE CONCAT('%', @keyword, '%')");
// // //         kwParts.Add($"c.name LIKE CONCAT('%', @keyword, '%')");

// // //         where += " AND (@keyword IS NULL OR (" + string.Join(" OR ", kwParts) + ")) ";

// // //         // SELECT with safe aliases
// // //         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

// // //         var countSql = $@"
// // // SELECT COUNT(1)
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // {where};
// // // ";

// // //         var listSql = $@"
// // // SELECT
// // //   r.id AS Id,
// // //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// // //   c.name AS CustomerName,
// // //   {SelCol(schema.StartCol, "StartAt")},
// // //   {SelCol(schema.EndCol, "EndAt")},
// // //   {SelCol(schema.TitleCol, "Title")},
// // //   {SelCol(schema.ContentCol, "Content")},
// // //   {SelCol(schema.StaffCol, "Staff")},
// // //   {SelCol(schema.LocationCol, "Location")},
// // //   {SelCol(schema.StatusCol, "Status")},
// // //   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // {where}
// // // ORDER BY r.{Q(schema.OrderCol)} DESC, r.id DESC
// // // LIMIT @pageSize OFFSET @offset;
// // // ";

// // //         var total = await conn.ExecuteScalarAsync<int>(countSql, p);
// // //         var items = (await conn.QueryAsync<ReservationDto>(listSql, p)).ToList();

// // //         return Ok(new PagedResult<ReservationDto>(items, total));
// // //     }

// // //     // =========================
// // //     // GET /api/customers/{id}/reservations
// // //     // =========================
// // //     [HttpGet("customers/{customerId:int}/reservations")]
// // //     [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
// // //     public Task<ActionResult<PagedResult<ReservationDto>>> GetCustomerReservations(
// // //         int customerId,
// // //         [FromQuery] int page = 1,
// // //         [FromQuery] int pageSize = 20,
// // //         [FromQuery] DateTime? from = null,
// // //         [FromQuery] DateTime? to = null,
// // //         [FromQuery] string? keyword = null
// // //     )
// // //     {
// // //         return GetReservations(page, pageSize, customerId, from, to, keyword);
// // //     }

// // //     // =========================
// // //     // POST /api/reservations
// // //     // =========================
// // //     [HttpPost("reservations")]
// // //     [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
// // //     public async Task<ActionResult<ReservationDto>> Create([FromBody] CreateReservationRequest req)
// // //     {
// // //         if (req.CustomerId <= 0) return BadRequest("CustomerId 必填");
// // //         if (req.StartAt is null) return BadRequest("StartAt 必填（预约开始时间）");

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         var cols = await GetReservationColumnsAsync(conn);
// // //         var schema = BuildSchema(cols);

// // //         if (schema.CustomerIdCol is null)
// // //             return BadRequest("tb_customer_reservation 缺少 customer_id 字段（或命名不同）。请把表结构（DDL）发我，我来精确适配。");

// // //         // choose a time col to insert
// // //         var startCol = schema.StartCol ?? schema.CreatedAtCol;
// // //         if (startCol is null)
// // //             return BadRequest("tb_customer_reservation 没有可用的时间字段（reservation_time/start_time/created_at 等）。请把表结构（DDL）发我。");

// // //         var insertCols = new List<string> { Q(schema.CustomerIdCol), Q(startCol) };
// // //         var insertVals = new List<string> { "@CustomerId", "@StartAt" };

// // //         var p = new DynamicParameters();
// // //         p.Add("@CustomerId", req.CustomerId);
// // //         p.Add("@StartAt", req.StartAt);

// // //         if (schema.EndCol is not null && req.EndAt is not null)
// // //         {
// // //             insertCols.Add(Q(schema.EndCol));
// // //             insertVals.Add("@EndAt");
// // //             p.Add("@EndAt", req.EndAt);
// // //         }

// // //         if (schema.TitleCol is not null && !string.IsNullOrWhiteSpace(req.Title))
// // //         {
// // //             insertCols.Add(Q(schema.TitleCol));
// // //             insertVals.Add("@Title");
// // //             p.Add("@Title", req.Title!.Trim());
// // //         }

// // //         if (schema.ContentCol is not null && !string.IsNullOrWhiteSpace(req.Content))
// // //         {
// // //             insertCols.Add(Q(schema.ContentCol));
// // //             insertVals.Add("@Content");
// // //             p.Add("@Content", req.Content!.Trim());
// // //         }

// // //         if (schema.StaffCol is not null && !string.IsNullOrWhiteSpace(req.Staff))
// // //         {
// // //             insertCols.Add(Q(schema.StaffCol));
// // //             insertVals.Add("@Staff");
// // //             p.Add("@Staff", req.Staff!.Trim());
// // //         }

// // //         if (schema.LocationCol is not null && !string.IsNullOrWhiteSpace(req.Location))
// // //         {
// // //             insertCols.Add(Q(schema.LocationCol));
// // //             insertVals.Add("@Location");
// // //             p.Add("@Location", req.Location!.Trim());
// // //         }

// // //         if (schema.StatusCol is not null && !string.IsNullOrWhiteSpace(req.Status))
// // //         {
// // //             insertCols.Add(Q(schema.StatusCol));
// // //             insertVals.Add("@Status");
// // //             p.Add("@Status", req.Status!.Trim());
// // //         }

// // //         // if created_at exists and is different from startCol, set NOW()
// // //         if (schema.CreatedAtCol is not null && schema.CreatedAtCol != startCol)
// // //         {
// // //             insertCols.Add(Q(schema.CreatedAtCol));
// // //             insertVals.Add("NOW()");
// // //         }

// // //         var sql = $@"
// // // INSERT INTO {schema.Table} ({string.Join(", ", insertCols)})
// // // VALUES ({string.Join(", ", insertVals)});
// // // SELECT LAST_INSERT_ID();
// // // ";

// // //         int newId;
// // //         try
// // //         {
// // //             newId = await conn.ExecuteScalarAsync<int>(sql, p);
// // //         }
// // //         catch (MySqlException ex)
// // //         {
// // //             // Most common: unknown column due to schema mismatch
// // //             return BadRequest($"创建预约失败：{ex.Message}");
// // //         }

// // //         // reuse list query for single record
// // //         var pageRes = await GetReservations(page: 1, pageSize: 1, customerId: req.CustomerId, from: null, to: null, keyword: null);
// // //         // But we need the exact record by id; do a small select
// // //         // (use adaptive columns same as above)
// // //         string SelCol(string? col, string alias) => col is null ? $"NULL AS {alias}" : $"r.{Q(col)} AS {alias}";

// // //         var getSql = $@"
// // // SELECT
// // //   r.id AS Id,
// // //   r.{Q(schema.CustomerIdCol)} AS CustomerId,
// // //   c.name AS CustomerName,
// // //   {SelCol(schema.StartCol, "StartAt")},
// // //   {SelCol(schema.EndCol, "EndAt")},
// // //   {SelCol(schema.TitleCol, "Title")},
// // //   {SelCol(schema.ContentCol, "Content")},
// // //   {SelCol(schema.StaffCol, "Staff")},
// // //   {SelCol(schema.LocationCol, "Location")},
// // //   {SelCol(schema.StatusCol, "Status")},
// // //   {SelCol(schema.CreatedAtCol, "CreatedAt")}
// // // FROM {schema.Table} r
// // // LEFT JOIN tb_customer_information c ON r.{Q(schema.CustomerIdCol)} = c.id
// // // WHERE r.id = @Id
// // // LIMIT 1;
// // // ";
// // //         var created = await conn.QueryFirstOrDefaultAsync<ReservationDto>(getSql, new { Id = newId });
// // //         if (created is null) return Ok(new ReservationDto { Id = newId, CustomerId = req.CustomerId, StartAt = req.StartAt });

// // //         return Ok(created);
// // //     }

// // //     // =========================
// // //     // DELETE /api/reservations/{id}
// // //     // =========================
// // //     [HttpDelete("reservations/{id:int}")]
// // //     public async Task<IActionResult> Delete(int id)
// // //     {
// // //         if (id <= 0) return BadRequest("id 无效");

// // //         await using var conn = new MySqlConnection(GetConnStr());
// // //         await conn.OpenAsync();

// // //         const string sql = "DELETE FROM tb_customer_reservation WHERE id = @Id;";
// // //         try
// // //         {
// // //             var rows = await conn.ExecuteAsync(sql, new { Id = id });
// // //             return rows > 0 ? Ok() : NotFound();
// // //         }
// // //         catch (MySqlException ex)
// // //         {
// // //             return BadRequest(ex.Message);
// // //         }
// // //     }
// // // }
