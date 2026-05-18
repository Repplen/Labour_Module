import { useState, useMemo } from "react";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function usePagination(data, { initialPageSize = 10, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS } = {}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize]
  );

  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return {
    paginatedData,
    currentPage: safePage,
    pageSize,
    totalItems,
    totalPages,
    pageSizeOptions,
    goToPage,
    changePageSize,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
