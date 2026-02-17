using Microsoft.AspNetCore.Mvc;
using crm_api.Models;
using crm_api.Repositories;
using MySqlConnector;

namespace crm_api.Controllers;

/// <summary>
/// CustomersController：客户模块接口（只负责 HTTP 层：参数/返回）
/// 路由前缀：/api/Customers
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class CustomersController : ControllerBase
{
    private readonly CustomerRepository _repo;

    public CustomersController(CustomerRepository repo)
    {
        _repo = repo;
    }

    
    // GET /api/Customers?keyword=zhang&page=1&pageSize=10
    /// 列表 + 搜索 + 分页

    [HttpGet]
    public async Task<ActionResult<PagedResult<CustomerDto>>> GetList(
        [FromQuery] string? keyword = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var (total, items) = await _repo.GetPagedAsync(keyword, page, pageSize);

            // ✅ 修复点：PagedResult 是 record 构造函数 (items, total)，不能用对象初始化 { }
            return Ok(new PagedResult<CustomerDto>(items, total));
        }
        catch (MySqlException ex)
        {
            Console.WriteLine($"[MySqlException] Number={ex.Number} Message={ex.Message}");
            return StatusCode(500, new { error = "MySQL error", message = ex.Message, number = ex.Number });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Exception] {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { error = "Server error", message = ex.Message });
        }
    }

    /// <summary>
    /// GET /api/Customers/{id}
    /// 查单个
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<CustomerDto>> GetById([FromRoute] int id)
    {
        var item = await _repo.GetByIdAsync(id);
        if (item == null)
            return NotFound(new { message = $"Customer id={id} not found." });

        return Ok(item);
    }

    /// <summary>
    /// POST /api/Customers
    /// 新增，返回 201 + Location
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CustomerDto dto)
    {
        var newId = await _repo.CreateAsync(dto);
        return Created($"/api/Customers/{newId}", new { id = newId });
    }

    /// <summary>
    /// PUT /api/Customers/{id}
    /// 更新，成功返回 204
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update([FromRoute] int id, [FromBody] CustomerDto dto)
    {
        var ok = await _repo.UpdateAsync(id, dto);
        if (!ok)
            return NotFound(new { message = $"Customer id={id} not found." });

        return NoContent(); // 204
    }

    /// <summary>
    /// DELETE /api/Customers/{id}
    /// 删除，成功返回 204
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int id)
    {
        var ok = await _repo.DeleteAsync(id);
        if (!ok)
            return NotFound(new { message = $"Customer id={id} not found." });

        return NoContent(); // 204
    }
}
