namespace crm_api.Models;

public class EventRecordDto
{
    public int Id { get; set; }
    public string EventId { get; set; } = Guid.NewGuid().ToString(); // 自动生成唯一编号
    public int CustomerId { get; set; }
    public DateTime EventTime { get; set; } = DateTime.Now;
    public string EventCharacter { get; set; } = "Note"; // 活动性质 (如 Call, Meeting)
    public string Staff { get; set; } = "Admin"; // 记录人
    public string Theme { get; set; } = string.Empty; // 主题/摘要
    public string Content { get; set; } = string.Empty; // 详细内容
}