import "../styles/pagination.css";

function ProductPagination({
  currentPage,
  pageSize,
  totalItems,
  itemLabel = "products",
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);
  const windowStart = Math.max(1, Math.min(safePage - 2, pageCount - 4));
  const windowEnd = Math.min(pageCount, windowStart + 4);
  const pageNumbers = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_value, index) => windowStart + index,
  );

  return (
    <div className="product-pagination">
      <p className="product-pagination-summary" aria-live="polite">
        Showing <strong>{firstItem}–{lastItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
      </p>

      <div className="product-pagination-controls">
        <label className="product-page-size">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label={`${itemLabel} per page`}
          >
            {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>per page</span>
        </label>

        {pageCount > 1 && (
          <nav className="product-page-nav" aria-label={`${itemLabel} pages`}>
            <button
              type="button"
              className="product-page-arrow"
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m12.5 4.5-5 5.5 5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {pageNumbers.map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={`product-page-number${pageNumber === safePage ? " is-current" : ""}`}
                onClick={() => onPageChange(pageNumber)}
                aria-current={pageNumber === safePage ? "page" : undefined}
                aria-label={`Page ${pageNumber}`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              className="product-page-arrow"
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage === pageCount}
              aria-label="Next page"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7.5 4.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export default ProductPagination;
