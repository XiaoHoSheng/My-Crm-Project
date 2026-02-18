using Microsoft.AspNetCore.Mvc;
using crm_api.Models;
using crm_api.Repositories;

namespace crm_api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OpportunitiesController : ControllerBase
{
    private readonly OpportunityRepository _repo;

    public OpportunitiesController(OpportunityRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<OpportunityDto>>> GetAll()
    {
        var list = await _repo.GetAllAsync();
        return Ok(list);
    }

    // ✅ 新增：获取指定客户的商机
    [HttpGet("ByCustomer/{customerId}")]
    public async Task<ActionResult<IEnumerable<OpportunityDto>>> GetByCustomer(int customerId)
    {
        var list = await _repo.GetByCustomerIdAsync(customerId);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOpportunityDto dto)
    {
        var id = await _repo.CreateAsync(dto);
        return Created($"/api/Opportunities/{id}", new { id });
    }

    [HttpPut("{id}/stage")]
    public async Task<IActionResult> UpdateStage(int id, [FromBody] string stage)
    {
        var success = await _repo.UpdateStageAsync(id, stage);
        return success ? NoContent() : NotFound();
    }
    
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateOpportunityDto dto)
    {
        var success = await _repo.UpdateAsync(id, dto);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _repo.DeleteAsync(id);
        return success ? NoContent() : NotFound();
    }
}