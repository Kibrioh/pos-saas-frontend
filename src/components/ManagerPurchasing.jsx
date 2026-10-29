import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { getProducts } from "../api/products";
import { formatKsh, toKsh, USD_TO_KSH } from "../utils/formatPrice";
import "../styles/manager-actions.css";
import { showManagerSuccess } from "../utils/managerToast";

function ManagerPurchasing({ products = [], setProducts }) {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });
  const [orderForm, setOrderForm] = useState({ supplier_id: "", note: "" });
  const [orderItems, setOrderItems] = useState([{ product_id: "", quantity: "", unit_cost: "" }]);
  const [receiveQuantities, setReceiveQuantities] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [supplierData, orderData, productData] = await Promise.all([
      apiFetch("/suppliers"),
      apiFetch("/purchase-orders"),
      getProducts(),
    ]);
    setSuppliers(Array.isArray(supplierData) ? supplierData : []);
    setOrders(Array.isArray(orderData) ? orderData : []);
    setProducts(productData);
  };

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, []);

  const addSupplier = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/suppliers", { method: "POST", body: JSON.stringify(supplierForm) });
      setSupplierForm({ name: "", phone: "", email: "" });
      await reload();
      showManagerSuccess("Supplier saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(orderForm.supplier_id),
          note: orderForm.note,
          items: orderItems.map((item) => ({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            unit_cost: Number(item.unit_cost) / USD_TO_KSH,
          })),
        }),
      });
      setOrderForm((current) => ({ ...current, note: "" }));
      setOrderItems([{ product_id: "", quantity: "", unit_cost: "" }]);
      await reload();
      showManagerSuccess("Purchase order created successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const receiveOrder = async (order) => {
    const items = order.items
      .map((item) => ({
        purchase_order_item_id: item.id,
        quantity: Number(receiveQuantities[item.id] || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      setError("Enter the delivered quantity for at least one outstanding order line.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/purchase-orders/${order.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setReceiveQuantities({});
      await reload();
      showManagerSuccess(`Delivery recorded for PO-${order.id}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="manager-content manager-purchasing-page">
      <div className="manager-page-heading">
        <div>
          <p className="manager-page-kicker">SUPPLIERS & STOCK ORDERS</p>
          <h2>Purchasing</h2>
          <p>Track suppliers, ordered quantities, deliveries, and purchase costs.</p>
        </div>
        <div className="inventory-summary"><strong>{orders.length}</strong><span>Purchase orders</span></div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Add Supplier</h3><p>Keep supplier contact details for future orders.</p></div></div>
        <form className="purchasing-form" onSubmit={addSupplier}>
          <label>Supplier name<input value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} required /></label>
          <label>Phone<input value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label>
          <label>Email<input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label>
          <button className="manager-action-button manager-action-button--primary purchasing-form-submit" disabled={busy}>Save supplier</button>
        </form>
      </section>

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Create Purchase Order</h3><p>Receive orders in full or in multiple deliveries.</p></div></div>
        {suppliers.length === 0 ? <p>Add a supplier before creating an order.</p> : products.length === 0 ? <p>Add active products before creating an order.</p> : (
          <form className="purchasing-form" onSubmit={createOrder}>
            <label>Supplier<select value={orderForm.supplier_id} onChange={(event) => setOrderForm({ ...orderForm, supplier_id: event.target.value })} required><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            {orderItems.map((item, index) => <div className="purchase-order-input-row purchasing-form-wide" key={`po-item-${index}`}>
              <label>Product<select value={item.product_id} onChange={(event) => setOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, product_id: event.target.value } : line))} required><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
              <label>Quantity<input type="number" min="1" step="1" value={item.quantity} onChange={(event) => setOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: event.target.value } : line))} required /></label>
              <label>Unit cost (KSh)<input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, unit_cost: event.target.value } : line))} required /></label>
              {orderItems.length > 1 && <button type="button" className="manager-action-button manager-action-button--danger-soft" onClick={() => setOrderItems((current) => current.filter((_line, lineIndex) => lineIndex !== index))}>Remove line</button>}
            </div>)}
            <button type="button" className="manager-action-button manager-action-button--secondary purchasing-form-wide manager-add-order-line" onClick={() => setOrderItems((current) => [...current, { product_id: "", quantity: "", unit_cost: "" }])}>+ Add another product</button>
            <label className="purchasing-form-wide">Note<input value={orderForm.note} onChange={(event) => setOrderForm({ ...orderForm, note: event.target.value })} /></label>
            <button className="manager-action-button manager-action-button--primary purchasing-form-submit" disabled={busy}>Create order</button>
          </form>
        )}
      </section>

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Purchase Orders</h3><p>{orders.length} recent orders</p></div></div>
        {orders.length === 0 ? <div className="empty-inventory"><p>No purchase orders yet.</p></div> : (
          <div className="purchase-order-list">
            {orders.map((order) => (
              <article className="purchase-order-card" key={order.id}>
                <div className="purchase-order-heading">
                  <div><h4>PO-{order.id}</h4><p>{order.supplier_name} · {new Date(order.created_at).toLocaleDateString()}</p></div>
                  <span className={`purchase-order-status status-${order.status}`}>{order.status.replaceAll("_", " ")}</span>
                </div>
                <ul>{order.items.map((item) => <li key={item.id}><span>{item.product_title}</span><span>{item.received_quantity} / {item.quantity} received</span><strong>{formatKsh(toKsh(item.unit_cost))} each</strong>{item.received_quantity < item.quantity && <label className="receive-quantity">Delivered now<input type="number" min="0" max={item.quantity - item.received_quantity} step="1" value={receiveQuantities[item.id] || ""} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></label>}</li>)}</ul>
                {order.note && <p className="purchase-order-note">{order.note}</p>}
                {order.status !== "received" && order.status !== "cancelled" && <button className="manager-action-button manager-action-button--primary" type="button" disabled={busy} onClick={() => receiveOrder(order)}>Record delivery</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ManagerPurchasing;
