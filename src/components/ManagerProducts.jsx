import { apiFetch } from "../api/client";
import {
  deleteProduct as deleteProductRequest,
  getProducts,
} from "../api/products";
import { useEffect, useMemo, useState } from "react";
import { formatPrice, toKsh, USD_TO_KSH } from "../utils/formatPrice";
import ProductPagination from "./ProductPagination";
import "../styles/manager-actions.css";
import { showManagerSuccess } from "../utils/managerToast";

function ManagerProducts({
  products = [],
  setProducts,
  categories = [],
  loading = false,
  error = null,
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [editingId, setEditingId] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [editingDetailsId, setEditingDetailsId] = useState(null);
  const [productDetailsForm, setProductDetailsForm] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [thumbnailPreviewError, setThumbnailPreviewError] = useState(false);

  const [newProduct, setNewProduct] = useState({
    title: "",
    brand: "",
    barcode: "",
    thumbnail: "",
    category_id: "",
    price: "",
    unit_cost: "",
    stock: "",
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.title
          .toLowerCase()
          .includes(query) ||
        product.brand
          ?.toLowerCase()
          .includes(query);

      const matchesCategory =
        category === "all" ||
        product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const pagedProducts = useMemo(() => {
    const firstIndex = (visiblePage - 1) * pageSize;
    return filteredProducts.slice(firstIndex, firstIndex + pageSize);
  }, [filteredProducts, visiblePage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const reloadProducts = async () => {
    setProducts(await getProducts());
  };

  const updateStock = async (id, amount) => {
    const product = products.find((item) => item.id === id);

    if (!product) {
      return;
    }

    const delta = Math.max(product.stock + amount, 0) - product.stock;

    if (delta === 0) {
      return;
    }

    try {
      const me = await apiFetch("/auth/me");

      await apiFetch("/stock/adjust", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(id),
          delta,
          user_id: me.user.id,
          note: "Manual adjustment by manager",
        }),
      });

      await reloadProducts();
      showManagerSuccess(`Stock updated for ${product.title}.`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const makeOutOfStock = (id) => {
    const product = products.find((item) => item.id === id);

    if (!product) {
      return;
    }

    return updateStock(id, -product.stock);
  };

  const deleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Remove "${product.title}" from the active catalogue? Historical sales and stock records will be kept.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProductRequest(product.id);
      await reloadProducts();
      showManagerSuccess(`${product.title} removed from the active catalogue.`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const startEditingPrice = (product) => {
    setEditingDetailsId(null);
    setProductDetailsForm(null);
    setEditingId(product.id);
    setNewPrice(String(toKsh(product.price)));
  };

  const startEditingDetails = (product) => {
    const categoryId = product.category_id ?? categories.find(
      (categoryRecord) => categoryRecord.name === product.category,
    )?.id;

    setEditingId(null);
    setNewPrice("");
    setEditingDetailsId(product.id);
    setDetailsError("");
    setProductDetailsForm({
      title: product.title || "",
      brand: product.brand || "",
      barcode: product.barcode || "",
      thumbnail: product.thumbnail || "",
      description: product.description || "",
      category_id: categoryId ? String(categoryId) : "",
    });
  };

  const saveProductDetails = async (event, product) => {
    event.preventDefault();
    if (!productDetailsForm?.title.trim() || !productDetailsForm.category_id) {
      setDetailsError("Enter a product name and choose a category.");
      return;
    }

    setSavingDetails(true);
    setDetailsError("");
    try {
      await apiFetch(`/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: productDetailsForm.title.trim(),
          brand: productDetailsForm.brand.trim() || null,
          barcode: productDetailsForm.barcode.trim() || null,
          thumbnail: productDetailsForm.thumbnail.trim() || null,
          description: productDetailsForm.description.trim() || null,
          category_id: Number(productDetailsForm.category_id),
        }),
      });
      await reloadProducts();
      setEditingDetailsId(null);
      setProductDetailsForm(null);
      showManagerSuccess(`${product.title} details saved.`);
    } catch (err) {
      setDetailsError(err.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const savePrice = async (id) => {
    const priceKsh = Number(newPrice);

    if (priceKsh <= 0 || Number.isNaN(priceKsh)) {
      return;
    }

    try {
      await apiFetch(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ price: priceKsh / USD_TO_KSH }),
      });

      await reloadProducts();
      setEditingId(null);
      setNewPrice("");
      const product = products.find((item) => item.id === id);
      showManagerSuccess(`Price updated${product ? ` for ${product.title}` : ""}.`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const handleNewProductChange = (e) => {
    const { name, value } = e.target;

    if (name === "thumbnail") {
      setThumbnailPreviewError(false);
    }

    setNewProduct((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addProduct = async (e) => {
    e.preventDefault();
    const createdTitle = newProduct.title.trim();

    if (
      !newProduct.title.trim() ||
      !newProduct.price ||
      newProduct.stock === "" ||
      !newProduct.category_id
    ) {
      return;
    }

    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          title: newProduct.title.trim(),
          brand: newProduct.brand.trim() || "TechPoint",
          barcode: newProduct.barcode.trim() || null,
          thumbnail: newProduct.thumbnail.trim() || null,
          category_id: Number(newProduct.category_id),
          price: Number(newProduct.price) / USD_TO_KSH,
          unit_cost: newProduct.unit_cost === "" ? null : Number(newProduct.unit_cost) / USD_TO_KSH,
          stock_quantity: Number(newProduct.stock),
          description: "Product added by the TechPoint manager.",
        }),
      });

      await reloadProducts();
      setCurrentPage(1);

      setNewProduct({
        title: "",
        brand: "",
        barcode: "",
        thumbnail: "",
        category_id: "",
        price: "",
        unit_cost: "",
        stock: "",
      });
      setThumbnailPreviewError(false);
      showManagerSuccess(`${createdTitle} added to inventory.`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const formatCategory = (value) => {
    return String(value || "")
      .split("-")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  };

  return (
    <main className="manager-content manager-products-page">
      <div className="manager-page-heading">
        <div>
          <p className="manager-page-kicker">
            INVENTORY MANAGEMENT
          </p>

          <h2>Products & Inventory</h2>

          <p>
            Manage prices, stock and products
            available to cashiers.
          </p>
        </div>

        <div className="inventory-summary">
          <strong>
            {products.length}
          </strong>

          <span>Products</span>
        </div>
      </div>

      <section className="manager-section">
        <div className="inventory-controls">
          <div className="manager-search">
            <label htmlFor="product-search">
              Search products
            </label>

            <input
              id="product-search"
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search by name or brand..."
            />
          </div>

          <div className="manager-filter">
            <label htmlFor="category-filter">
              Category
            </label>

            <select
              id="category-filter"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
            >
              <option value="all">
                All categories
              </option>

              {categories.map(
                (categoryRecord) => (
                  <option
                    key={categoryRecord.id}
                    value={categoryRecord.name}
                  >
                    {categoryRecord.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="manager-section">
        <div className="section-heading-row">
          <div>
            <h3>Product Catalogue</h3>

            <p>
              Showing{" "}
              <strong>
                {filteredProducts.length}
              </strong>{" "}
              product
              {filteredProducts.length === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-inventory" role="status">
            <p>Loading inventory from the database…</p>
          </div>
        ) : error ? (
          <div className="empty-inventory" role="alert">
            <p>{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-inventory">
            <h3>No products found</h3>

            <p>
              Try changing your search or
              category filter.
            </p>
          </div>
        ) : (
          <div className="manager-product-grid">
            {pagedProducts.map((product) => (
              <article
                className="manager-product-card"
                key={product.id}
              >
                <div className="manager-product-image">
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                  />
                </div>

                <div className="manager-product-info">
                  <span className="manager-product-category">
                    {formatCategory(
                      product.category
                    )}
                  </span>

                  <h3>{product.title}</h3>

                  <p className="manager-product-brand">
                    {product.brand || "No brand"}
                  </p>

                  {product.barcode && (
                    <p className="manager-product-barcode">Barcode · {product.barcode}</p>
                  )}

                  <div className="manager-product-price">
                    {editingId === product.id ? (
                      <div className="price-edit">
                        <input
                          type="number"
                          min="1"
                          value={newPrice}
                          onChange={(e) =>
                            setNewPrice(
                              e.target.value
                            )
                          }
                        />

                        <button
                          className="button-success"
                          onClick={() =>
                            savePrice(product.id)
                          }
                        >
                          Save
                        </button>

                        <button
                          className="button-secondary"
                          onClick={() => {
                            setEditingId(null);
                            setNewPrice("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <strong>
                          {formatPrice(product.price)}
                        </strong>

                        <button
                          className="button-secondary"
                          onClick={() =>
                            startEditingPrice(product)
                          }
                        >
                          Edit Price
                        </button>
                      </>
                    )}
                  </div>

                  <div
                    className={`stock-status ${
                    product.stock === 0
                        ? "out-of-stock"
                        : product.stock <= (product.low_stock_threshold ?? 5)
                        ? "low-stock"
                        : "in-stock"
                    }`}
                  >
                    {product.stock === 0
                      ? "Out of Stock"
                      : `${product.stock} units available`}
                  </div>

                  <div className="inventory-actions">
                    <button
                      className="button-primary"
                      onClick={() =>
                        updateStock(product.id, 1)
                      }
                    >
                      + Stock
                    </button>

                    <button
                      className="button-secondary"
                      onClick={() =>
                        updateStock(product.id, -1)
                      }
                      disabled={product.stock === 0}
                    >
                      - Stock
                    </button>

                    <button
                      className="button-warning"
                      onClick={() =>
                        makeOutOfStock(product.id)
                      }
                      disabled={product.stock === 0}
                    >
                      Out of Stock
                    </button>

                    <button
                      className="button-danger"
                      onClick={() =>
                        deleteProduct(product)
                      }
                    >
                      Delete
                    </button>
                  </div>

                  {editingDetailsId === product.id ? (
                    <form
                      className="product-details-edit-form"
                      onSubmit={(event) => saveProductDetails(event, product)}
                    >
                      <div className="product-details-edit-heading">
                        <div>
                          <h4>Edit product details</h4>
                          <p>Update the catalog information shown to cashiers.</p>
                        </div>
                      </div>
                      <div className="product-details-edit-grid">
                        <label>
                          Product name
                          <input
                            value={productDetailsForm?.title || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, title: event.target.value }))}
                            maxLength="200"
                            required
                          />
                        </label>
                        <label>
                          Brand
                          <input
                            value={productDetailsForm?.brand || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, brand: event.target.value }))}
                            maxLength="120"
                          />
                        </label>
                        <label>
                          Category
                          <select
                            value={productDetailsForm?.category_id || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, category_id: event.target.value }))}
                            required
                          >
                            <option value="">Choose a category</option>
                            {categories.map((categoryRecord) => (
                              <option key={categoryRecord.id} value={categoryRecord.id}>
                                {categoryRecord.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          SKU / barcode
                          <input
                            value={productDetailsForm?.barcode || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, barcode: event.target.value }))}
                            maxLength="80"
                          />
                        </label>
                        <label className="product-details-edit-wide">
                          Thumbnail image URL
                          <input
                            type="url"
                            value={productDetailsForm?.thumbnail || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, thumbnail: event.target.value }))}
                            placeholder="https://example.com/product.jpg"
                          />
                        </label>
                        <label className="product-details-edit-wide">
                          Description
                          <textarea
                            value={productDetailsForm?.description || ""}
                            onChange={(event) => setProductDetailsForm((current) => ({ ...current, description: event.target.value }))}
                            rows="3"
                          />
                        </label>
                      </div>
                      {detailsError && <p className="product-details-edit-error" role="alert">{detailsError}</p>}
                      <div className="product-details-edit-actions">
                        <button className="manager-action-button manager-action-button--primary" type="submit" disabled={savingDetails}>
                          {savingDetails ? "Saving…" : "Save details"}
                        </button>
                        <button
                          className="manager-action-button manager-action-button--secondary"
                          type="button"
                          onClick={() => {
                            setEditingDetailsId(null);
                            setProductDetailsForm(null);
                            setDetailsError("");
                          }}
                          disabled={savingDetails}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="manager-action-button manager-action-button--secondary product-details-edit-toggle"
                      type="button"
                      onClick={() => startEditingDetails(product)}
                    >
                      Edit product details
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && filteredProducts.length > 0 && (
          <ProductPagination
            currentPage={visiblePage}
            pageSize={pageSize}
            totalItems={filteredProducts.length}
            pageSizeOptions={[12, 20, 50]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </section>

      <section className="manager-section add-product-section">
        <div className="section-heading-row">
          <div>
            <h3>Add New Product</h3>

            <p>Register a product in the database catalogue.</p>
          </div>
        </div>

        <form
          className="add-product-form"
          onSubmit={addProduct}
        >
          <div>
            <label htmlFor="new-title">
              Product name
            </label>

            <input
              id="new-title"
              name="title"
              type="text"
              value={newProduct.title}
              onChange={handleNewProductChange}
              placeholder="e.g. Wireless Keyboard"
            />
          </div>

          <div>
            <label htmlFor="new-brand">
              Brand
            </label>

            <input
              id="new-brand"
              name="brand"
              type="text"
              value={newProduct.brand}
              onChange={handleNewProductChange}
              placeholder="e.g. Logitech"
            />
          </div>

          <div>
            <label htmlFor="new-barcode">SKU / barcode</label>
            <input
              id="new-barcode"
              name="barcode"
              type="text"
              value={newProduct.barcode}
              onChange={handleNewProductChange}
              placeholder="Scan or enter a unique code"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="new-thumbnail">
              Thumbnail image URL
            </label>

            <input
              id="new-thumbnail"
              name="thumbnail"
              type="url"
              value={newProduct.thumbnail}
              onChange={handleNewProductChange}
              placeholder="https://example.com/product.jpg"
            />

            {newProduct.thumbnail.trim() && (
              thumbnailPreviewError ? (
                <small className="thumbnail-preview-message">
                  Image preview unavailable
                </small>
              ) : (
                <img
                  className="add-product-thumbnail-preview"
                  src={newProduct.thumbnail.trim()}
                  alt="Product thumbnail preview"
                  onError={() => setThumbnailPreviewError(true)}
                />
              )
            )}
          </div>

          <div>
            <label htmlFor="new-category">
              Category
            </label>

            <select
              id="new-category"
              name="category_id"
              value={newProduct.category_id}
              onChange={handleNewProductChange}
              disabled={categories.length === 0}
            >
              <option value="">
                {categories.length === 0 ? "No categories available" : "Select a category"}
              </option>
              {categories.map(
                (categoryRecord) => (
                  <option
                    key={categoryRecord.id}
                    value={categoryRecord.id}
                  >
                    {categoryRecord.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label htmlFor="new-price">
              Price (KSh)
            </label>

            <input
              id="new-price"
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              value={newProduct.price}
              onChange={handleNewProductChange}
              placeholder="Price"
            />
          </div>

          <div>
            <label htmlFor="new-unit-cost">Unit cost (KSh, optional)</label>
            <input
              id="new-unit-cost"
              name="unit_cost"
              type="number"
              min="0"
              step="0.01"
              value={newProduct.unit_cost}
              onChange={handleNewProductChange}
              placeholder="Purchase cost"
            />
          </div>

          <div>
            <label htmlFor="new-stock">
              Initial stock
            </label>

            <input
              id="new-stock"
              name="stock"
              type="number"
              min="0"
              value={newProduct.stock}
              onChange={handleNewProductChange}
              placeholder="Stock"
            />
          </div>

          <button
            className="button-primary add-product-button"
            type="submit"
          >
            + Add Product
          </button>
        </form>
      </section>
    </main>
  );
}

export default ManagerProducts;
