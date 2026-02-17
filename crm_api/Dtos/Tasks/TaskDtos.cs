namespace crm_api.Dtos.Tasks;

public class TaskDto
{
    public long Id { get; set; }
    public string Title { get; set; } = "";
    public string Status { get; set; } = "Pending"; // Pending | Doing | Done
    public string? AssignedTo { get; set; }
    public DateTime? DueDate { get; set; }

    // ✅ 新增：关联客户
    public long? CustomerId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TaskCreateDto
{
    public string Title { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string? AssignedTo { get; set; }
    public DateTime? DueDate { get; set; }

    // ✅ 新增：创建时可绑定客户
    public long? CustomerId { get; set; }
}

public class TaskUpdateDto
{
    public string Title { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string? AssignedTo { get; set; }
    public DateTime? DueDate { get; set; }

    // ✅ 新增：更新时可改绑定客户（不传则不改）
    public long? CustomerId { get; set; }
}
