const joinClasses = (...cls) => cls.filter(Boolean).join(" ");

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const set = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) set.add(i);

  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push(`ellipsis-${p}`);
    result.push(p);
    prev = p;
  }
  return result;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  hasPrev,
  hasNext,
  goToPage,
  changePageSize,
  className = "",
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageRange = buildPageRange(currentPage, totalPages);

  return (
    <div className={joinClasses("pagination-bar", className)}>
      <span className="pagination-bar__info">
        {totalItems === 0 ? "No items" : `Showing ${startItem}–${endItem} of ${totalItems}`}
      </span>

      <nav aria-label="Page navigation">
        <ul className="pagination pagination-sm mb-0">
          <li className={joinClasses("page-item", !hasPrev && "disabled")}>
            <button
              className="page-link"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!hasPrev}
              aria-label="Previous page"
            >
              ‹
            </button>
          </li>

          {pageRange.map((p) =>
            typeof p === "string" ? (
              <li key={p} className="page-item disabled">
                <span className="page-link pagination-ellipsis">…</span>
              </li>
            ) : (
              <li key={p} className={joinClasses("page-item", p === currentPage && "active")}>
                <button className="page-link" onClick={() => goToPage(p)} aria-current={p === currentPage ? "page" : undefined}>
                  {p}
                </button>
              </li>
            )
          )}

          <li className={joinClasses("page-item", !hasNext && "disabled")}>
            <button
              className="page-link"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!hasNext}
              aria-label="Next page"
            >
              ›
            </button>
          </li>
        </ul>
      </nav>

      <div className="pagination-bar__size">
        <label className="pagination-bar__size-label" htmlFor="page-size-select">
          Rows
        </label>
        <select
          id="page-size-select"
          className="form-select form-select-sm pagination-bar__size-select"
          value={pageSize}
          onChange={(e) => changePageSize(Number(e.target.value))}
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
