import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { getProducts } from "../api/products";
import { formatPrice, toKsh } from "../utils/formatPrice";

const AUDIT_LABELS = {
  opening_cash: "Opening float",
  expected_cash: "Expected till cash",
  amount_tendered: "Cash received",
  change_given: "Change given",
  total_amount: "Sale total",
  cash_variance: "Cash difference",
  item_count: "Number of items",
  cashier_id: "Cashier",
  user_id: "User",
  actor_id: "User ID",
  shift_id: "Shift ID",
  delta: "Stock quantity change",
  quantity_change: "Stock quantity change",
};

function formatAuditLabel(key) {
  return (
    AUDIT_LABELS[key]
    || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatAuditValue(value, key = "", userNames = {}) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "cashier_id" || key === "user_id") {
    return userNames[value] || `User ${value}`;
  }
  if (key === "delta" || key === "quantity_change") {
    const quantity = Number(value);
    if (Number.isFinite(quantity) && quantity !== 0) {
      return quantity > 0
        ? `${quantity} unit${quantity === 1 ? "" : "s"} added to stock`
        : `${Math.abs(quantity)} unit${quantity === -1 ? "" : "s"} removed from stock`;
    }
  }
  if (key === "cash_variance") {
    const difference = Number(value);
    if (Number.isFinite(difference)) {
      const amountKsh = toKsh(Math.abs(difference));
      if (!amountKsh) return "Balanced";
      const amount = formatPrice(Math.abs(difference));
      return difference > 0 ? `Over by ${amount}` : `Short by ${amount}`;
    }
  }
  const isMoneyValue = typeof value === "number" || typeof value === "string";
  if (
    isMoneyValue
    && /(price|cost|amount|cash|tendered|change|given)$/i.test(key)
    && Number.isFinite(Number(value))
  ) {
    return formatPrice(value);
  }
  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => formatAuditValue(item, "", userNames)).join("; ")
      : "None";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([nestedKey, nestedValue]) => (
        `${formatAuditLabel(nestedKey)}: ${formatAuditValue(nestedValue, nestedKey, userNames)}`
      ))
      .join(" · ");
  }
  return String(value);
}

function ManagerAudit() {
  const [events, setEvents] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [cashiers, setCashiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [saleIdFilter, setSaleIdFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  useEffect(() => {
    apiFetch("/audit?limit=200")
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  }, []);

  const actions = [...new Set(events.map((event) => event.action).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const saleIds = [...new Set(events.flatMap((event) => [
    ...(event.entity_type === "sale" && event.entity_id != null ? [event.entity_id] : []),
    ...(event.details?.sale_id != null ? [event.details.sale_id] : []),
  ]))]
    .sort((left, right) => Number(right) - Number(left));
  const productIds = [...new Set(events.flatMap((event) => [
    ...(event.entity_type === "product" && event.entity_id != null ? [event.entity_id] : []),
    ...(event.details?.product_id != null ? [event.details.product_id] : []),
  ]))]
    .sort((left, right) => Number(left) - Number(right));
  const filteredEvents = events.filter((event) => (
    (actionFilter === "all" || event.action === actionFilter)
    && (saleIdFilter === "all" || String(event.entity_type === "sale" ? event.entity_id : event.details?.sale_id) === saleIdFilter)
    && (cashierFilter === "all" || [event.actor_user_id, event.details?.cashier_id, event.details?.user_id].some((id) => String(id) === cashierFilter))
    && (productFilter === "all" || [event.entity_type === "product" ? event.entity_id : null, event.details?.product_id].some((id) => String(id) === productFilter))
  ));

  useEffect(() => {
    apiFetch("/auth/users")
      .then((data) => {
        const names = {};
        (data.users || []).forEach((user) => {
          names[user.id] = user.name || user.username;
        });
        setUserNames(names);
        setCashiers((data.users || [])
          .filter((user) => user.role === "cashier")
          .sort((left, right) => (left.name || left.username).localeCompare(right.name || right.username, undefined, { sensitivity: "base" })));
      })
      .catch(() => setUserNames({}));
  }, []);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  return (
    <main className="manager-content">
      <div className="manager-page-heading">
        <div>
          <p className="manager-page-kicker">ACCOUNTABILITY</p>
          <h2>Audit history</h2>
          <p>Recent stock, sales, pricing, purchasing, returns, and till actions.</p>
        </div>
        <div className="inventory-summary"><strong>{filteredEvents.length}</strong><span>Matching events</span></div>
      </div>
      <section className="manager-section">
        <div className="manager-filter-toolbar manager-audit-filters" role="group" aria-label="Filter audit events">
          <label className="manager-filter-control"><span>Action</span><select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="all">All actions</option>{actions.map((action) => <option key={action} value={action}>{action.replaceAll(".", " ")}</option>)}</select></label>
          <label className="manager-filter-control"><span>Sale ID</span><select value={saleIdFilter} onChange={(event) => setSaleIdFilter(event.target.value)}><option value="all">All sales</option>{saleIds.map((id) => <option key={id} value={id}>Sale #{id}</option>)}</select></label>
          <label className="manager-filter-control"><span>Cashier</span><select value={cashierFilter} onChange={(event) => setCashierFilter(event.target.value)}><option value="all">All cashiers</option>{cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.name || cashier.username}</option>)}</select></label>
          <label className="manager-filter-control"><span>Product</span><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="all">All products</option>{productIds.map((id) => {
            const product = products.find((record) => String(record.id) === String(id));
            return <option key={id} value={id}>{product?.title || `Product #${id}`}</option>;
          })}</select></label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : events.length === 0 ? <div className="empty-inventory"><p>No audit activity yet.</p></div> : filteredEvents.length === 0 ? <div className="empty-inventory"><p>No audit events match those filters.</p></div> : (
          <div className="audit-event-list">
            {filteredEvents.map((event) => (
              <article className="audit-event" key={event.id}>
                <div className="audit-event-heading">
                  <div><strong>{event.action.replaceAll(".", " ")}</strong><span>{event.entity_type} #{event.entity_id ?? "—"}</span></div>
                  <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                </div>
                <p>By {event.actor_name}</p>
                <details>
                  <summary>Details</summary>
                  {event.details && Object.keys(event.details).length > 0 ? (
                    <dl className="audit-event-details">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key}>
                          <dt>{formatAuditLabel(key)}</dt>
                          <dd>{formatAuditValue(value, key, userNames)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="audit-event-no-details">No additional details.</p>
                  )}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ManagerAudit;
