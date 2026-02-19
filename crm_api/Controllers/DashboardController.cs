using Microsoft.AspNetCore.Mvc;
using crm_api.Models;
using crm_api.Repositories;

namespace crm_api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly DashboardRepository _repo;

    public DashboardController(DashboardRepository repo)
    {
        _repo = repo;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        return Ok(await _repo.GetStatsAsync());
    }

    [HttpGet("funnel")]
    public async Task<ActionResult<IEnumerable<StageStatDto>>> GetFunnel()
    {
        return Ok(await _repo.GetStageStatsAsync());
    }

    [HttpGet("recent-won")]
    public async Task<ActionResult<IEnumerable<RecentDealDto>>> GetRecentWon()
    {
        return Ok(await _repo.GetRecentWonDealsAsync());
    }
}