using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using crm_api.Models;
using crm_api.Repositories;

namespace crm_api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserRepository _repo;
    private readonly IConfiguration _config;

    public AuthController(UserRepository repo, IConfiguration config)
    {
        _repo = repo;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _repo.GetByUsernameAsync(request.Username);

        // 验证用户存不存在，以及密码对不对 (为了演示先用明文对比，生产环境要用 BCrypt)
        if (user == null || user.Password != request.Password)
        {
            return Unauthorized(new { message = "用户名或密码错误" });
        }

        // 密码正确，生成 JWT Token
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(_config["Jwt:Key"]!);
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role)
            }),
            Expires = DateTime.UtcNow.AddDays(7), // Token 7天有效
            Issuer = _config["Jwt:Issuer"],
            Audience = _config["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var jwtString = tokenHandler.WriteToken(token);

        return Ok(new LoginResponse { Token = jwtString, Username = user.Username });
    }
}