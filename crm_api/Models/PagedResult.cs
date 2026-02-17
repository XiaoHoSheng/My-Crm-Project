namespace crm_api.Models;

public class PagedResult<T>
{
    public int Total { get; set; }
    public List<T> Items { get; set; } = new();

    public PagedResult() { }

    public PagedResult(IReadOnlyList<T> items, int total)
    {
        Items = items?.ToList() ?? new List<T>();
        Total = total;
    }
}

















// namespace crm_api.Models;



// //通用分页返回结构：
// //兼容对象初始化：new PagedResult<T> { Total = x, Items = y }
// //兼容构造函数：new PagedResult<T>(items, total)

// public class PagedResult<T>
// {
//     public int Total { get; set; }
//     public List<T> Items { get; set; } = new();

//     public PagedResult() { }

//     public PagedResult(IReadOnlyList<T> items, int total)
//     {
//         Items = items?.ToList() ?? new List<T>();
//         Total = total;
//     }
// }




// namespace crm_api.Models;

// /// <summary>
// /// 通用分页返回结构（同时兼容：无参 new + 构造函数 new(items,total)）
// /// </summary>
// public class PagedResult<T>
// {
//     public long Total { get; set; }
//     public List<T> Items { get; set; } = new();

//     public PagedResult() { }

//     // 兼容你现在编译器提示的构造签名：PagedResult(IReadOnlyList<T>, long)
//     public PagedResult(IReadOnlyList<T> items, long total)
//     {
//         Items = items?.ToList() ?? new List<T>();
//         Total = total;
//     }
// }
