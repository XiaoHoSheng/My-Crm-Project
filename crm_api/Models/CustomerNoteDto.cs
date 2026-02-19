namespace crm_api.Models;

public class CustomerNoteDto
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}