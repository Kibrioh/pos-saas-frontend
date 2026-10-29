import Login from "./components/Login";
import ManagerDashboard from "./components/ManagerDashboard";
import ManagerNav from "./components/ManagerNav";
import ManagerProfile from "./components/ManagerProfile";
import ManagerSales from "./components/ManagerSales";
import ManagerProducts from "./components/ManagerProducts";
import ManagerCashiers from "./components/ManagerCashiers";
import ManagerPurchasing from "./components/ManagerPurchasing";
import ManagerAudit from "./components/ManagerAudit";
import ManagerShifts from "./components/ManagerShifts";
import CashierShiftPanel from "./components/CashierShiftPanel";
import About from "./components/About";

import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

const LocationIntelligence = lazy(() => import("./components/LocationIntelligence"));

import { getProducts } from "./api/products";
import { getCategories } from "./api/categories";
import { apiFetch, clearToken, getToken } from "./api/client";
import { cartReducer } from "./cart/cartReducer";
import {
  formatKsh,
  toKsh,
  USD_TO_KSH,
} from "./utils/formatPrice";

import {
  downloadReceiptText,
} from "./utils/receiptText";

import ProductList from "./components/ProductList";
import ProductPagination from "./components/ProductPagination";
import ProductDetails from "./components/ProductDetails";
import SearchBar from "./components/SearchBar";
import CategoryFilter from "./components/CategoryFilter";
import Cart from "./components/Cart";
import CheckoutDialog from "./components/CheckoutDialog";
import { filterProducts } from "./utils/filterProducts";
import { useDebounce } from "./hooks/useDebounce";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPathname = useRef(location.pathname);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryError, setCategoryError] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Restore a saved session before making tenant data requests.
  useEffect(() => {
    let isMounted = true;
    if (!getToken()) {
      setSessionReady(true);
      return () => { isMounted = false; };
    }

    apiFetch("/auth/me")
      .then(({ user }) => {
        if (!isMounted) return;
        setCurrentUser(user);
        const requestedPath = initialPathname.current;
        const isManagerPath = requestedPath === "/manager" || requestedPath.startsWith("/manager/");
        if (user.role === "manager" && !isManagerPath) {
          navigate("/manager", { replace: true });
        } else if (user.role !== "manager" && isManagerPath) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        if (isMounted) setSessionReady(true);
      });

    return () => { isMounted = false; };
  }, [navigate]);

  // Load the signed-in user's selected branch catalogue.
  useEffect(() => {
    let isMounted = true;
    if (!currentUser) {
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return () => { isMounted = false; };
    }

    setLoading(true);
    Promise.allSettled([getProducts(), getCategories()])
      .then(([productResult, categoryResult]) => {
        if (!isMounted) return;

        if (productResult.status === "fulfilled") {
          setProducts(productResult.value);
          setError(null);
        } else {
          setError(productResult.reason.message);
        }

        if (categoryResult.status === "fulfilled") {
          setCategories(categoryResult.value);
          setCategoryError(null);
        } else {
          setCategoryError(categoryResult.reason.message);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.active_branch_id]);

  /*
    Each cashier has their own cart.
  */
  const [cashierCarts, setCashierCarts] =
    useState({});

  const [heldCarts, setHeldCarts] = useState([]);
  const [sale, setSale] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [cashierShift, setCashierShift] = useState(null);
  const [cashierShiftRefreshKey, setCashierShiftRefreshKey] = useState(0);
  const [sessionSales, setSessionSales] =
    useState([]);
  const [managerSalesRevision, setManagerSalesRevision] = useState(0);

  const receiptRef = useRef(null);
  const pendingCheckoutRequest = useRef(null);

  useEffect(() => {
    if (currentUser?.role !== "cashier") {
      setCashierShift(null);
      return undefined;
    }

    let active = true;
    apiFetch("/shifts/current")
      .then((shift) => {
        if (active) setCashierShift(shift);
      })
      .catch(() => {
        if (active) setCashierShift(null);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role, cashierShiftRefreshKey]);

  const [view, setView] = useState("home");
  const [featuredIndex, setFeaturedIndex] =
    useState(0);

  const [selectedProduct, setSelectedProduct] =
    useState(null);
  const [selectedProductAnchor, setSelectedProductAnchor] =
    useState(null);


  /*
    Keep the cashier view synchronized
    with the current URL.
  */
  useEffect(() => {
    const pathToView = {
      "/": "home",
      "/cashier/products": "products",
      "/cashier/categories": "categories",
      "/cashier/orders": "orders",
      "/cashier/ledger": "ledger",
      "/cashier/low-stock": "low-stock",
      "/cashier/close-shift": "close-shift",
    };

    const nextView =
      pathToView[location.pathname];

    if (nextView) {
      setView(nextView);
    }
    setSale(null);
  }, [location.pathname]);

  /*
    Get the current cashier's cart.
  */
  const cart = currentUser
    ? cashierCarts[currentUser.username] ?? []
    : [];

  /*
    Apply cartReducer to the current
    cashier's cart.
  */
  const dispatch = (action) => {
  if (!currentUser) {
    return;
  }

  const username = currentUser.username;

  setCashierCarts((carts) => {
    const currentCart =
      carts[username] ?? [];

    const nextCart =
      cartReducer(
        currentCart,
        action
      );

    return {
      ...carts,
      [username]: nextCart,
    };
  });
};

  /*
    LOGIN
  */
  const handleLogin = (user) => {
    setCashierCarts((carts) => ({
      ...carts,

      [user.username]:
        carts[user.username] ?? [],
    }));

    setCurrentUser({
      ...user,
      active_branch_id: user.active_branch_id || user.branch_id,
    });
    setSale(null);
    setCheckoutOpen(false);
    setCheckoutError("");
    setCashierShift(null);
    setSelectedProduct(null);

    if (user.role === "manager") {
      navigate("/manager");
    } else {
      navigate("/");
    }
  };

  /*
    LOGOUT / SWITCH USER

    The current cashier's cart is preserved.
  */
  const handleSwitchUser = () => {
    setSale(null);
    setCheckoutOpen(false);
    setCheckoutError("");
    setCashierShift(null);
    setSelectedProduct(null);
    setSearchInput("");
    setCategory("all");
    setView("home");
    clearToken();
    pendingCheckoutRequest.current = null;
    setCurrentUser(null);

    navigate("/");
  };

  /*
    Featured products
  */
  const featuredProducts = useMemo(() => {
    const productsByCategory = new Map();

    products.forEach((product) => {
      const categoryProducts =
        productsByCategory.get(
          product.category
        ) ?? [];

      if (categoryProducts.length < 2) {
        categoryProducts.push(product);
      }

      productsByCategory.set(
        product.category,
        categoryProducts
      );
    });

    return [
      ...productsByCategory.values(),
    ].flat();
  }, [products]);

  useEffect(() => {
    if (
      featuredProducts.length < 2 ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setFeaturedIndex(
        (index) =>
          (index + 1) %
          featuredProducts.length
      );
    }, 4500);

    return () =>
      window.clearInterval(intervalId);
  }, [featuredProducts.length]);

  /*
    Search and filter
  */
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [category, setCategory] =
    useState("all");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(12);

   const filteredProducts = useMemo(() => {
    const matches = filterProducts(products, search, category);

    if (view !== "low-stock") return matches;

    return matches.filter((product) => {
      const quantityInCart =
        cart.find((item) => item.id === product.id)?.quantity ?? 0;

      return (
        product.stock > 0 &&
        product.stock - quantityInCart <=
          (product.low_stock_threshold ?? 5)
      );
    });
  }, [products, search, category, view, cart]);

  const productPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / productPageSize),
  );
  const currentProductPage = Math.min(productPage, productPageCount);
  const pagedProducts = useMemo(() => {
    const firstIndex = (currentProductPage - 1) * productPageSize;
    return filteredProducts.slice(firstIndex, firstIndex + productPageSize);
  }, [filteredProducts, currentProductPage, productPageSize]);

  useEffect(() => {
    setProductPage(1);
  }, [search, category, view]);

  useEffect(() => {
    setProductPage((currentPage) => Math.min(currentPage, productPageCount));
  }, [productPageCount]);

  /*
    Low-stock count
  */
  const lowStockCount = products.filter(
    (product) => {
      const quantityInCart =
        cart.find(
          (item) => item.id === product.id
        )?.quantity ?? 0;

      return (
        product.stock > 0 &&
        product.stock - quantityInCart <=
          (product.low_stock_threshold ?? 5)
      );
    }
  ).length;

  const featuredProduct =
    featuredProducts[featuredIndex];

  const latestSale =
    sessionSales[
      sessionSales.length - 1
    ];

  /*
    Featured product controls
  */
  const moveFeatured = (direction) => {
    if (featuredProducts.length === 0) {
      return;
    }

    setFeaturedIndex(
      (index) =>
        (index +
          direction +
          featuredProducts.length) %
        featuredProducts.length
    );
  };

  /*
    Navigation
  */
    const clearFilters = () => {
    setSearchInput("");
    setCategory("all");
    setView("products");
    navigate("/cashier/products");
  };

  const navigateTo = (nextView) => {
    setSearchInput("");
    setCategory("all");
    setSelectedProduct(null);
    setSale(null);
    setView(nextView);

    const routes = {
  home: "/",
  products: "/cashier/products",
  categories: "/cashier/categories",
  orders: "/cashier/orders",
   ledger: "/cashier/ledger",
  "low-stock": "/cashier/low-stock",
  "close-shift": "/cashier/close-shift",
};

    navigate(routes[nextView] || "/");
  };

  const handleBarcodeScan = (barcode) => {
    const normalizedBarcode = barcode.trim().toLowerCase();
    const product = products.find(
      (item) => item.barcode?.trim().toLowerCase() === normalizedBarcode,
    );
    if (!product) return false;

    const quantityInCart = cart.find((item) => item.id === product.id)?.quantity || 0;
    if (quantityInCart >= product.stock) {
      window.alert(`${product.title} is out of stock.`);
    } else {
      dispatch({ type: "ADD", product });
    }
    setSearchInput("");
    return true;
  };

  /*
    HOLD SALE
  */
  const holdSale = () => {
    if (cart.length === 0) {
      return;
    }

    const heldSale = {
      id: Date.now(),
      cashier: currentUser.username,
      items: cart,
      heldAt: new Date().toISOString(),
    };

    setHeldCarts((sales) => [
      ...sales,
      heldSale,
    ]);

    dispatch({
      type: "CLEAR",
    });
  };

  /*
    RESTORE HELD SALE
  */
  const restoreHeldSale = (id) => {
    if (cart.length > 0) {
      window.alert(
        "Please complete, clear, or hold the current sale before restoring another sale."
      );

      return;
    }

    const heldSale =
      heldCarts.find(
        (sale) => sale.id === id
      );

    if (!heldSale) {
      return;
    }

    const stockProblem =
      heldSale.items.find((item) => {
        const currentProduct =
          products.find(
            (product) =>
              product.id === item.id
          );

        return (
          !currentProduct ||
          currentProduct.stock <
            item.quantity
        );
      });

    if (stockProblem) {
      window.alert(
        "This held sale cannot be restored because one or more products no longer have enough stock."
      );

      return;
    }

    dispatch({
      type: "RESTORE",
      items: heldSale.items,
    });

    setHeldCarts((sales) =>
      sales.filter(
        (sale) => sale.id !== id
      )
    );
  };

  /*
    COMPLETE SALE
  */
  const completeSale = async ({ paymentMethod, amountTenderedKsh }) => {
    if (cart.length === 0) {
      return false;
    }

    const stockProblem =
      cart.find((item) => {
        const currentProduct =
          products.find(
            (product) =>
              product.id === item.id
          );

        return (
          !currentProduct ||
          item.quantity >
            currentProduct.stock
        );
      });

    if (stockProblem) {
      setCheckoutError(
        "The sale cannot be completed because one or more products do not have enough stock."
      );
      return false;
    }
    let serverSale;
    const requestBody = {
      payment_method: paymentMethod,
      amount_tendered: paymentMethod === "cash"
        ? Number(amountTenderedKsh) / USD_TO_KSH
        : null,
      items: cart.map((item) => ({
        product_id: Number(item.id),
        quantity: item.quantity,
      })),
    };
    const requestSignature = JSON.stringify({
      ...requestBody,
      amount_tendered_ksh: paymentMethod === "cash" ? Number(amountTenderedKsh) : null,
    });
    if (pendingCheckoutRequest.current?.signature !== requestSignature) {
      pendingCheckoutRequest.current = {
        signature: requestSignature,
        key: globalThis.crypto?.randomUUID?.()
          || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
    }

    try {
      serverSale = await apiFetch("/sales", {
        method: "POST",
        headers: { "Idempotency-Key": pendingCheckoutRequest.current.key },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      setCheckoutError(err.message);
      return false;
    }

    pendingCheckoutRequest.current = null;

    setCashierShiftRefreshKey((current) => current + 1);

    const saleNumber = String(serverSale.id).padStart(6, "0");
    const totalKsh = toKsh(serverSale.total_amount);
    const paymentMethodLabel = {
      cash: "Cash",
      card: "Card",
      "m-pesa": "M-Pesa",
    }[serverSale.payment_method || paymentMethod] || paymentMethod;
    const completedSale = {
      id: serverSale.id,
      orderId: `ORD-${saleNumber}`,
      receiptNumber: `RCP-${saleNumber}`,
      createdAt: serverSale.created_at,
      completedAt: serverSale.created_at,
      cashier: currentUser.name || currentUser.username,
      items: serverSale.items.map((item) => ({
        id: item.product_id,
        title: item.product_title,
        price: Number(item.unit_price),
        quantity: item.quantity,
        lineTotalKsh: toKsh(item.subtotal),
      })),
      subtotalKsh: totalKsh,
      totalKsh,
      total: totalKsh,
      paymentMethod: paymentMethodLabel,
      amountTenderedKsh: serverSale.amount_tendered == null
        ? null
        : toKsh(serverSale.amount_tendered),
      changeGivenKsh: toKsh(serverSale.change_given ?? 0),
      itemCount: serverSale.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    };

    /*
      Reduce stock.
    */
    setProducts(
      (currentProducts) =>
        currentProducts.map(
          (product) => {
            const soldItem =
              cart.find(
                (item) =>
                  item.id ===
                  product.id
              );

            if (!soldItem) {
              return product;
            }

            return {
              ...product,

              stock:
                product.stock -
                soldItem.quantity,
            };
          }
        )
    );

    // Refresh the catalogue from the database after the sale is committed.
    getProducts()
      .then(setProducts)
      .catch(() => {});

    /*
      Save receipt.
    */
    setSale(completedSale);
    setCheckoutOpen(false);
    setCheckoutError("");

    /*
      Save sale for manager.
    */
    setSessionSales((sales) => [
      ...sales,
      completedSale,
    ]);

    /*
      Clear only current cashier's cart.
    */
    dispatch({
      type: "CLEAR",
    });

    /*
      Scroll to receipt.
    */
    setTimeout(() => {
      receiptRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return true;
  };

  /*
    MANAGER: load all sales from the backend.
  */
  useEffect(() => {
    if (currentUser?.role !== "manager") {
      return;
    }

    Promise.all([
      apiFetch("/sales"),
      apiFetch("/reports/sales-by-cashier"),
    ])
      .then(([salesData, cashierData]) => {
        const names = {};
        (cashierData.results || []).forEach((c) => {
          names[c.user_id] = c.username;
        });

        const list = Array.isArray(salesData) ? salesData : [];

        setSessionSales(
          list
            .slice()
            .reverse()
            .map((sale) => ({
              id: sale.id,
              cashier: names[sale.user_id] || `user ${sale.user_id}`,
              items: sale.items.map((item) => ({
                id: item.product_id,
                saleItemId: item.id,
                title: item.product_title,
                price: toKsh(item.unit_price),
                quantity: item.quantity,
              })),
              returns: (sale.returns || []).map((returnRecord) => ({
                ...returnRecord,
                refund_total: toKsh(returnRecord.refund_total),
              })),
              total: toKsh(sale.total_amount),
              itemCount: sale.items.reduce(
                (sum, item) => sum + item.quantity,
                0
              ),
              completedAt: sale.created_at,
              paymentMethod: String(sale.payment_method || "").replace(/^./, (c) => c.toUpperCase()),
            }))
        );
      })
      .catch((err) => console.error("Could not load sales:", err.message));
  }, [currentUser, managerSalesRevision]);

  /*
    Sales history and the stock ledger load when their screens open,
    and sales history refreshes after a sale is completed.
  */
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ledger, setLedger] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [printOrder, setPrintOrder] = useState(null);

  const orderedReceipts = orders.slice().reverse();
  const receiptPage = Math.min(
    historyPage,
    Math.max(1, Math.ceil(orderedReceipts.length / historyPageSize))
  );
  const visibleReceipts = orderedReceipts.slice(
    (receiptPage - 1) * historyPageSize,
    receiptPage * historyPageSize
  );
  const orderedLedger = ledger.slice().reverse();
  const ledgerPage = Math.min(
    historyPage,
    Math.max(1, Math.ceil(orderedLedger.length / historyPageSize))
  );
  const visibleLedger = orderedLedger.slice(
    (ledgerPage - 1) * historyPageSize,
    ledgerPage * historyPageSize
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [view]);

  useEffect(() => {
    if (!printOrder) return undefined;

    document.body.classList.add("printing-history-receipt");
    const finishPrinting = () => setPrintOrder(null);
    const printTimer = window.setTimeout(() => window.print(), 100);
    window.addEventListener("afterprint", finishPrinting, { once: true });

    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", finishPrinting);
      document.body.classList.remove("printing-history-receipt");
    };
  }, [printOrder]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (view !== "orders" && view !== "ledger") {
      return;
    }

    const isManager = currentUser.role === "manager";

    const toArray = (data, key) =>
      Array.isArray(data) ? data : (data && data[key]) || [];

    const loadUserNames = async () => {
      const names = {};

      if (!isManager) {
        return names;
      }

      try {
        const data = await apiFetch("/auth/users");
        (data.users || []).forEach((u) => {
          names[u.id] = u.name || u.username;
        });
      } catch {
        // names fall back to "user <id>"
      }

      return names;
    };

    const loadOrders = async () => {
      setHistoryPage(1);
      const names = await loadUserNames();
      const data = await apiFetch(isManager ? "/sales" : "/sales/mine");

      setOrders(
        toArray(data, "sales")
          .slice()
          .reverse()
          .map((sale) => ({
            id: sale.id,
            receiptNumber: "RCP-" + String(sale.id).padStart(6, "0"),
            orderId: "ORD-" + String(sale.id).padStart(6, "0"),
            cashier: isManager
              ? names[sale.user_id] || "user " + sale.user_id
              : currentUser.name || currentUser.username,
            createdAt: sale.created_at,
            totalKsh: toKsh(sale.total_amount),
            amountTenderedKsh: sale.amount_tendered == null
              ? null
              : toKsh(sale.amount_tendered),
            changeGivenKsh: toKsh(sale.change_given),
            netAfterRefundsKsh: toKsh(
              Number(sale.total_amount) - (sale.returns || []).reduce(
                (sum, returnRecord) => sum + Number(returnRecord.refund_total || 0),
                0
              )
            ),
            returns: (sale.returns || []).map((returnRecord) => ({
              id: returnRecord.id,
              reason: returnRecord.reason,
              refundMethod: returnRecord.refund_method,
              refundTotalKsh: toKsh(returnRecord.refund_total),
              createdAt: returnRecord.created_at,
              items: returnRecord.items || [],
            })),
            items: (sale.items || []).map((item) => ({
              id: item.id,
              title: item.product_title || `Product #${item.product_id}`,
              quantity: item.quantity,
              unitPriceKsh: toKsh(item.unit_price),
              lineTotalKsh: toKsh(item.subtotal),
            })),
            itemCount: (sale.items || []).reduce(
              (sum, item) => sum + item.quantity,
              0
            ),
            paymentMethod: String(sale.payment_method || "").replace(
              /^./,
              (c) => c.toUpperCase()
            ),
          }))
      );
    };

    const loadLedger = async () => {
      setHistoryPage(1);
      const [names, movementData, productData] = await Promise.all([
        loadUserNames(),
        apiFetch("/stock/movements"),
        apiFetch("/products"),
      ]);

      const titles = {};
      toArray(productData, "products").forEach((p) => {
        titles[p.id] = p.title;
      });

      setLedger(
        toArray(movementData, "movements")
          .slice()
          .reverse()
          .map((m) => ({
            id: m.id,
            type: m.movement_type,
            productTitle: titles[m.product_id] || "Product #" + m.product_id,
            user: m.user_name || names[m.user_id] || "user " + m.user_id,
            createdAt: m.created_at,
            quantity: Math.abs(m.quantity_delta),
            before: m.stock_before,
            after: m.stock_after,
            delta: m.quantity_delta,
          }))
      );
    };

    const run = view === "orders" ? loadOrders : loadLedger;
    if (view === "orders") {
      setOrdersLoading(true);
    }

    run().catch((err) =>
      console.error("Could not load history:", err.message)
    ).finally(() => {
      if (view === "orders") {
        setOrdersLoading(false);
      }
    });
  }, [currentUser, view, sale]);

  /*
    PRODUCT DETAILS
  */
  const handleViewDetails = (product, anchorElement) => {
    setSelectedProduct(product);
    setSelectedProductAnchor(anchorElement);
  };

  const closeProductDetails = () => {
    setSelectedProduct(null);
    setSelectedProductAnchor(null);
  };

  /*
    LOGIN SCREEN
  */
  if (!sessionReady) {
    return <div className="login-loading" role="status">Restoring your session…</div>;
  }

  if (!currentUser) {
    return (
      <Login
        onLogin={handleLogin}
      />
    );
  }

  /*
    ABOUT PAGE
  */
  if (location.pathname === "/about") {
    return (
      <About
        onBack={() => navigate("/")}
      />
    );
  }

  /*
    MANAGER AREA
  */
  if (
    currentUser.role ===
    "manager"
  ) {
    return (
      <div className="manager-layout">
        <ManagerNav
          user={currentUser}
          onLogout={
            handleSwitchUser
          }
        />

        <div className="manager-main">
          <Routes>
          <Route
            path="/manager"
            element={
              <ManagerDashboard
              />
            }
          />

          <Route
            path="/manager/profile"
            element={(
              <ManagerProfile
                user={currentUser}
                onProfileUpdated={(updatedUser) => setCurrentUser((user) => ({
                  ...user,
                  ...updatedUser,
                }))}
              />
            )}
          />

          <Route
            path="/manager/sales"
            element={
              <ManagerSales
                sales={sessionSales}
                  onReturnCreated={() => setManagerSalesRevision((revision) => revision + 1)}
              />
            }
          />

            <Route
              path="/manager/purchasing"
              element={
                <ManagerPurchasing
                  products={products}
                  setProducts={setProducts}
                />
              }
            />
            <Route path="/manager/shifts" element={<ManagerShifts />} />
            <Route path="/manager/audit" element={<ManagerAudit />} />
            <Route
              path="/manager/locations"
              element={(
                <Suspense fallback={<div className="location-loading">Loading location report…</div>}>
                  <LocationIntelligence />
                </Suspense>
              )}
            />

          <Route
            path="/manager/products"
            element={
              <ManagerProducts
                products={products}
                categories={categories}
                loading={loading}
                error={error}
                setProducts={
                  setProducts
                }
              />
            }
          />

          <Route
            path="/manager/cashiers"
            element={
              <ManagerCashiers />
            }
          />

          <Route
            path="*"
            element={
              <ManagerDashboard
              />
            }
          />
          </Routes>
        </div>
      </div>
    );
  }

  /*
    CASHIER AREA
  */
  const currentCashierHeldSales =
    heldCarts.filter(
      (heldSale) =>
        heldSale.cashier ===
        currentUser.username
    );

  return (
    <div className="pos-app">
      <header className="app-header">
        <button
          className="brand-lockup"
          type="button"
          onClick={() =>
            navigateTo("home")
          }
          aria-label="TechPoint home"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            T
          </span>

          <span className="brand-copy">
            <span className="brand-name">
              TechPoint
            </span>

            <span className="brand-caption">
              Point of sale
            </span>
          </span>
        </button>

        <nav
          className="app-nav"
          aria-label="Main navigation"
        >
          <button
            className={`app-nav-button${
              view === "home"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              view === "home"
                ? "page"
                : undefined
            }
            onClick={() =>
              navigateTo("home")
            }
          >
            Home
          </button>

          <button
            className={`app-nav-button${
              view === "categories"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              view === "categories"
                ? "page"
                : undefined
            }
            onClick={() =>
              navigateTo(
                "categories"
              )
            }
          >
            Categories
          </button>

          <button
            className={`app-nav-button${
              view === "products"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              view === "products"
                ? "page"
                : undefined
            }
            onClick={() =>
              navigateTo(
                "products"
              )
            }
          >
            Products
          </button>

          <button
            className={`app-nav-button${
              view === "orders"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              view === "orders"
                ? "page"
                : undefined
            }
            onClick={() =>
              navigateTo(
                "orders"
              )
            }
          >
            My Sales
          </button>

          <button
            className={`app-nav-button${view === "close-shift" ? " is-active" : ""}`}
            type="button"
            aria-current={view === "close-shift" ? "page" : undefined}
            onClick={() => navigateTo("close-shift")}
          >
            Close shift
          </button>

          <button
  className={`app-nav-button${
    view === "ledger"
      ? " is-active"
      : ""
  }`}
  type="button"
  aria-current={
    view === "ledger"
      ? "page"
      : undefined
  }
  onClick={() =>
    navigateTo("ledger")
  }
>
  Ledger
</button>

          <button
            className={`app-nav-button${
              view === "low-stock"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              view === "low-stock"
                ? "page"
                : undefined
            }
            onClick={() =>
              navigateTo(
                "low-stock"
              )
            }
          >
            Low stock
          </button>

          <button
            className={`app-nav-button${
              location.pathname ===
              "/about"
                ? " is-active"
                : ""
            }`}
            type="button"
            aria-current={
              location.pathname ===
              "/about"
                ? "page"
                : undefined
            }
            onClick={() => {
              setSelectedProduct(null);
              navigate("/about");
            }}
          >
            About
          </button>
        </nav>

        <div className="terminal-status">
          <span
            className="status-indicator"
            aria-hidden="true"
          />

          <span>
            {currentUser.username}
          </span>

          <button
            type="button"
            onClick={
              handleSwitchUser
            }
          >
            Switch User
          </button>
        </div>
      </header>

      {/* HOME */}

      {view === "home" ? (
        <main className="home-content">
          <section
            className="welcome-hero"
            aria-labelledby="welcome-title"
          >
            <div className="welcome-copy">
              <p className="welcome-kicker">
                TECHPOINT · HOME
              </p>

              <h1 id="welcome-title">
                Welcome back.
                <br />
                Let’s get selling.
              </h1>

              <p className="welcome-description">
                Your counter is ready. Pick
                up where you left off and
                make the next sale.
              </p>

              <button
                className="start-sale-button"
                type="button"
                onClick={() =>
                  navigateTo(
                    "products"
                  )
                }
              >
                Start a sale{" "}
                <span aria-hidden="true">
                  →
                </span>
              </button>

              <p className="welcome-hint">
                Your product catalogue is
                ready whenever you are.
              </p>
            </div>

            <div
              className="welcome-feature"
              role="region"
              aria-label="Featured products"
              aria-roledescription="carousel"
            >
              {featuredProduct ? (
                <>
                  <span className="feature-label">
                    IN THE SHOP
                  </span>

                  {featuredProducts.length >
                    1 && (
                    <div className="feature-controls">
                      <span aria-hidden="true">
                        {String(
                          featuredIndex +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}{" "}
                        /{" "}
                        {String(
                          featuredProducts.length
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <button
                        className="feature-control-button"
                        type="button"
                        aria-label="Previous featured product"
                        onClick={() =>
                          moveFeatured(
                            -1
                          )
                        }
                      >
                        ←
                      </button>

                      <button
                        className="feature-control-button"
                        type="button"
                        aria-label="Next featured product"
                        onClick={() =>
                          moveFeatured(
                            1
                          )
                        }
                      >
                        →
                      </button>
                    </div>
                  )}

                  <img
                    key={
                      featuredProduct.id
                    }
                    src={
                      featuredProduct.thumbnail
                    }
                    alt={
                      featuredProduct.title
                    }
                  />

                  <div className="feature-product-copy">
                    <span>
                      {featuredProduct.category.replaceAll(
                        "-",
                        " "
                      )}
                    </span>

                    <strong>
                      {
                        featuredProduct.title
                      }
                    </strong>

                    <span className="feature-product-price">
                      {formatKsh(toKsh(featuredProduct.price))}
                    </span>
                  </div>
                </>
              ) : (
                <p className="feature-placeholder">
                  {loading
                    ? "Loading your inventory…"
                    : "Your featured product will appear here."}
                </p>
              )}
            </div>
          </section>

          <section
            className="home-overview"
            aria-labelledby="overview-title"
          >
            <div className="overview-heading">
              <div>
                <p className="section-kicker">
                  AT A GLANCE
                </p>

                <h2 id="overview-title">
                  Live at your counter
                </h2>
              </div>

              {error && (
                <p
                  className="overview-error"
                  role="status"
                >
                  Inventory unavailable
                </p>
              )}
            </div>

            <div className="overview-stats">
              <button
                className="overview-stat overview-stat-button"
                type="button"
                aria-label={`View all ${products.length} products`}
                onClick={() =>
                  navigateTo(
                    "products"
                  )
                }
              >
                <span>
                  Products listed
                </span>

                <strong>
                  {loading
                    ? "—"
                    : products.length}
                </strong>
              </button>

              <button
                className="overview-stat overview-stat-button"
                type="button"
                aria-label={`Browse ${categories.length} product categories`}
                onClick={() =>
                  navigateTo(
                    "categories"
                  )
                }
              >
                <span>
                  Product categories
                </span>

                <strong>
                  {loading
                    ? "—"
                    : categories.length}
                </strong>
              </button>

              <button
                className="overview-stat overview-stat-button"
                type="button"
                aria-label={`View ${lowStockCount} low-stock products`}
                onClick={() =>
                  navigateTo(
                    "low-stock"
                  )
                }
              >
                <span>
                  Running low
                </span>

                <strong>
                  {loading
                    ? "—"
                    : lowStockCount}
                </strong>
              </button>

              <div className="overview-stat">
                <span>
                  Sales this session
                </span>

                <strong>
                  {sessionSales.length}
                </strong>
              </div>
            </div>
          </section>

          <section
            className="recent-activity"
            aria-labelledby="activity-title"
          >
            <div>
              <p className="section-kicker">
                RECENT ACTIVITY
              </p>

              <h2 id="activity-title">
                Latest sale
              </h2>
            </div>

            {latestSale ? (
              <p className="recent-activity-detail">
                <span>
                  {latestSale.itemCount}{" "}
                  item
                  {latestSale.itemCount ===
                  1
                    ? ""
                    : "s"}{" "}
                  sold for{" "}
                  <strong>
                    {formatKsh(
                      latestSale.totalKsh
                    )}
                  </strong>
                  {" · "}
                  Cashier:{" "}
                  {latestSale.cashier}
                </span>

                <time
                  dateTime={
                    latestSale.completedAt
                  }
                >
                  {new Intl.DateTimeFormat(
                    undefined,
                    {
                      hour: "numeric",
                      minute:
                        "2-digit",
                    }
                  ).format(
                    new Date(
                      latestSale.completedAt
                    )
                  )}
                </time>
              </p>
            ) : (
              <p className="recent-activity-empty">
                No completed sales this
                session
              </p>
            )}
          </section>
        </main>
      ) : view === "categories" ? (
        <main className="main-content">
          <section
            className="category-directory"
            aria-labelledby="categories-title"
          >
            <div className="catalogue-heading">
              <div>
                <p className="section-kicker">
                  STORE INVENTORY
                </p>

                <h1 id="categories-title">
                  Product categories
                </h1>

                <p className="section-description">
                  Choose a category to
                  browse its products.
                </p>
              </div>
            </div>

            {loading ? (
              <div
                className="catalogue-message"
                role="status"
                aria-live="polite"
              >
                <span
                  className="loading-indicator"
                  aria-hidden="true"
                />

                <p>
                  Loading categories...
                </p>
              </div>
            ) : categoryError ? (
              <div
                className="catalogue-message catalogue-message--error"
                role="alert"
              >
                <h2>
                  Categories couldn’t
                  be loaded
                </h2>

                <p>{categoryError}</p>
              </div>
            ) : categories.length ===
              0 ? (
              <div className="catalogue-message">
                <h2>
                  No categories available
                </h2>

                <p>
                  There are no product
                  categories to display
                  right now.
                </p>
              </div>
            ) : (
              <ul className="category-list">
                {categories.map(
                  (categoryRecord) => {
                    const categoryName = categoryRecord.name;
                    const productCount =
                      products.filter(
                        (product) =>
                          product.category_id === categoryRecord.id
                      ).length;

                    const categoryLabel =
                      categoryName
                        .split("-")
                        .map(
                          (word) =>
                            word
                              .charAt(
                                0
                              )
                              .toUpperCase() +
                            word.slice(
                              1
                            )
                        )
                        .join(" ");

                    return (
                      <li
                        key={categoryRecord.id}
                      >
                        <button
                          className="category-list-button"
                          type="button"
                          onClick={() => {
                            setCategory(
                              categoryName
                            );

                            setView(
                              "products"
                            );

                            navigate(
                              "/cashier/products"
                            );
                          }}
                        >
                          <span className="category-list-copy">
                            <strong>
                              {
                                categoryLabel
                              }
                            </strong>

                            <span>
                              {
                                productCount
                              }{" "}
                              products
                            </span>
                          </span>

                          <span
                            className="category-list-arrow"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        </button>
                      </li>
                    );
                  }
                )}
              </ul>
            )}
          </section>
        </main>
      ) : view === "orders" ? (
        <main className="main-content">
          <section className="catalogue">
            <div className="catalogue-heading">
              <div>
                <p className="section-kicker">
                  SALES HISTORY
                </p>

                <h1>
                  My Sales
                </h1>

                <p>
                  Review each completed sale, its items, payment, and any returns.
                </p>
              </div>
            </div>

            {ordersLoading ? (
              <div className="catalogue-message" role="status">
                <p>Loading your sales…</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="catalogue-message">
                <h2>
                  No sales yet
                </h2>

                <p>
                  Your completed sales will appear here with receipt details.
                </p>
              </div>
            ) : (
              <>
              <div className="orders-list">
                {visibleReceipts.map((order) => (
                    <article
                      key={order.id}
                      className="order-card cashier-sale-card"
                    >
                      <div>
                        <p className="section-kicker">
                          {order.receiptNumber}
                        </p>

                        <h2>
                          {order.orderId}
                        </h2>

                        <p>
                          Cashier:{" "}
                          {order.cashier?.name ??
                            order.cashier}
                        </p>

                        <p>
                          {new Date(
                            order.createdAt
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <strong>
                          {formatKsh(
                            order.totalKsh
                          )}
                        </strong>

                        <p>
                          {order.itemCount} item(s)
                        </p>

                        <p>
                          Paid via:{" "}
                          {order.paymentMethod}
                        </p>

                        <details className="cashier-sale-details">
                          <summary>View receipt details</summary>
                          <div className="cashier-sale-detail-content">
                            <dl className="cashier-sale-payment">
                              <div>
                                <dt>Original total</dt>
                                <dd>{formatKsh(order.totalKsh)}</dd>
                              </div>
                              <div>
                                <dt>Refunds</dt>
                                <dd>
                                  {formatKsh(order.returns.reduce(
                                    (sum, returnRecord) => sum + returnRecord.refundTotalKsh,
                                    0
                                  ))}
                                </dd>
                              </div>
                              <div>
                                <dt>Net after refunds</dt>
                                <dd>
                                  {formatKsh(order.netAfterRefundsKsh)}
                                </dd>
                              </div>
                              {order.amountTenderedKsh != null && (
                                <div>
                                  <dt>Cash received</dt>
                                  <dd>{formatKsh(order.amountTenderedKsh)}</dd>
                                </div>
                              )}
                              {order.amountTenderedKsh != null && (
                                <div>
                                  <dt>Change given</dt>
                                  <dd>{formatKsh(order.changeGivenKsh)}</dd>
                                </div>
                              )}
                            </dl>

                            <h3>Items sold</h3>
                            {order.items.length ? (
                              <ul className="cashier-sale-items">
                                {order.items.map((item) => (
                                  <li key={item.id}>
                                    <span>{item.title} <small>{item.quantity} × {formatKsh(item.unitPriceKsh)}</small></span>
                                    <strong>{formatKsh(item.lineTotalKsh)}</strong>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>No item details are available for this sale.</p>
                            )}

                            {order.returns.length > 0 && (
                              <div className="cashier-sale-returns">
                                <h3>Returns and refunds</h3>
                                {order.returns.map((returnRecord) => (
                                  <div key={returnRecord.id}>
                                    <strong>{formatKsh(returnRecord.refundTotalKsh)} refunded via {returnRecord.refundMethod}</strong>
                                    <p>{returnRecord.reason} · {new Date(returnRecord.createdAt).toLocaleString()}</p>
                                    {returnRecord.items.map((item, index) => (
                                      <small key={`${item.sale_item_id}-${index}`}>
                                        {item.product_title}: {item.quantity} returned
                                      </small>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                        <button
                          className="cashier-sale-print-button"
                          type="button"
                          onClick={() => setPrintOrder(order)}
                        >
                          <span aria-hidden="true">▣</span> Print this receipt
                        </button>
                      </div>
                    </article>
                ))}
              </div>
              <ProductPagination
                currentPage={receiptPage}
                pageSize={historyPageSize}
                totalItems={orderedReceipts.length}
                itemLabel="receipts"
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => {
                  setHistoryPageSize(size);
                  setHistoryPage(1);
                }}
              />
              </>
            )}
          </section>
        </main>
            ) : view === "ledger" ? (
        <main className="main-content">
          <section className="catalogue">
            <div className="catalogue-heading">
              <div>
                <p className="section-kicker">
                  STOCK LEDGER
                </p>

                <h1>
                  Ledger
                </h1>

                <p>
                  Browse stock additions, sales, and quantity updates.
                </p>
              </div>
            </div>

            {ledger.length === 0 ? (
              <div className="catalogue-message">
                <h2>
                  No ledger entries yet
                </h2>

                <p>
                  Restocks, sales, and stock updates will appear here.
                </p>
              </div>
            ) : (
              <>
              <div className="orders-list">
                {visibleLedger.map((entry) => (
                    <article
                      key={entry.id}
                      className="order-card"
                    >
                      <div>
                        <p className="section-kicker">
                          {entry.type?.toUpperCase()}
                        </p>

                        <h2>
                          {entry.productTitle}
                        </h2>

                        <p>
                          {entry.type === "sale" ? "Cashier" : "Recorded by"}: {entry.user}
                        </p>

                        <p>
                          {new Date(
                            entry.createdAt
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <strong>
                          {entry.quantity} unit(s)
                        </strong>

                        <p>
                          Stock before: {entry.before}
                        </p>

                        <p>
                          Stock after: {entry.after}
                        </p>

                        <p>
                          Stock movement: {entry.delta > 0
                            ? `${entry.delta} unit${entry.delta === 1 ? "" : "s"} added`
                            : `${Math.abs(entry.delta)} unit${entry.delta === -1 ? "" : "s"} removed`}
                        </p>
                      </div>
                    </article>
                ))}
              </div>
              <ProductPagination
                currentPage={ledgerPage}
                pageSize={historyPageSize}
                totalItems={orderedLedger.length}
                itemLabel="ledger entries"
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => {
                  setHistoryPageSize(size);
                  setHistoryPage(1);
                }}
              />
              </>
            )}
          </section>
        </main>
      ) : view === "close-shift" ? (
        <main className="main-content">
          <section className="catalogue close-shift-page" aria-labelledby="close-shift-title">
            <div className="catalogue-heading">
              <div>
                <p className="section-kicker">CASH CONTROL</p>
                <h1 id="close-shift-title">Close shift</h1>
                <p className="section-description">Review your expected till balance and reconcile counted cash before ending your shift.</p>
              </div>
            </div>
            <CashierShiftPanel
              user={currentUser}
              onShiftChange={setCashierShift}
              refreshKey={cashierShiftRefreshKey}
            />
          </section>
        </main>
      ) : (
        <main className="main-content">
          <section
            className="catalogue"
            aria-labelledby="catalogue-title"
          >
            <div className="catalogue-heading">
              <div>
                <p className="section-kicker">
                  STORE INVENTORY
                </p>

                <h1 id="catalogue-title">
                  {view === "low-stock"
                    ? "Low-stock products"
                    : "Browse products"}
                </h1>

                <p className="section-description">
                  {view ===
                  "low-stock"
                    ? "Products at or below their low-stock threshold."
                    : "Electronics and accessories for every setup."}
                </p>
              </div>

              {!loading &&
                !error && (
                  <p className="product-count">
                    <strong>
                      {products.length}
                    </strong>{" "}
                    products
                  </p>
                )}
            </div>

            {sale && view !== "low-stock" && (
              <div
                className="sale-confirmation"
                ref={receiptRef}
                role="status"
              >
                <h2>
                  Sale Completed
                </h2>

                <div className="receipt">
  <h3>
    TECHPOINT RECEIPT
  </h3>

  <p>
    <strong>Receipt:</strong>{" "}
    {sale.receiptNumber}
  </p>

  <p>
    <strong>Order:</strong>{" "}
    {sale.orderId}
  </p>

  <p>
    <strong>Cashier:</strong>{" "}
    {sale.cashier?.name ?? sale.cashier}
  </p>

  <p>
    <strong>Date:</strong>{" "}
    {new Date(
      sale.createdAt
    ).toLocaleString()}
  </p>

  <hr />

  {sale.items.map((item) => (
    <div
      key={item.id}
      className="receipt-item"
    >
      <div>
        <strong>
          {item.title}
        </strong>

        <p>
          {item.quantity} ×{" "}
          {formatKsh(
            toKsh(item.price)
          )}
        </p>
      </div>

      <strong>
        {formatKsh(
          item.lineTotalKsh ??
            toKsh(item.price) *
              item.quantity
        )}
      </strong>
    </div>
  ))}

  <hr />

  <div className="receipt-total">
    <strong>
      TOTAL
    </strong>

    <strong>
      {formatKsh(
        sale.totalKsh
      )}
    </strong>
  </div>

  <p>
    <strong>Payment:</strong>{" "}
    {sale.paymentMethod}
  </p>
  {sale.amountTenderedKsh != null && (
    <>
      <p><strong>Cash received:</strong> {formatKsh(sale.amountTenderedKsh)}</p>
      <p><strong>Change:</strong> {formatKsh(sale.changeGivenKsh)}</p>
    </>
  )}
</div>

                <div className="receipt-actions">
                  <button
                    type="button"
                    className="receipt-action-button receipt-action-button--print"
                    onClick={() =>
                      window.print()
                    }
                  >
                    <span aria-hidden="true">▣</span> Print receipt
                  </button>

                  <button
                    type="button"
                    className="receipt-action-button receipt-action-button--download"
                    onClick={() =>
                      downloadReceiptText(
                        sale
                      )
                    }
                  >
                    <span aria-hidden="true">↓</span> Download receipt
                  </button>
                </div>

                <p className="sale-success-message">
                  ✓ Sale completed
                  successfully.
                </p>

                <button
                  onClick={() =>
                    setSale(null)
                  }
                >
                  New Sale
                </button>
              </div>
            )}

            <div className="catalogue-controls">
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                onScan={view === "low-stock" ? undefined : handleBarcodeScan}
              />

              <CategoryFilter
                categories={
                  categories
                }
                selected={category}
                onChange={
                  setCategory
                }
              />
            </div>

            {view !== "low-stock" && currentCashierHeldSales.length >
              0 && (
              <section className="held-sales">
                <div className="held-sales-header">
                  <div>
                    <p className="section-kicker">
                      HELD SALES
                    </p>

                    <h2>
                      {
                        currentCashierHeldSales.length
                      }{" "}
                      sale
                      {currentCashierHeldSales.length ===
                      1
                        ? ""
                        : "s"}{" "}
                      on hold
                    </h2>
                  </div>
                </div>

                <div className="held-sales-list">
                  {currentCashierHeldSales.map(
                    (heldSale) => (
                      <div
                        className="held-sale-card"
                        key={
                          heldSale.id
                        }
                      >
                        <div>
                          <strong>
                            Sale #
                            {
                              heldSale.id
                            }
                          </strong>

                          <p>
                            {
                              heldSale.items.reduce(
                                (
                                  total,
                                  item
                                ) =>
                                  total +
                                  item.quantity,
                                0
                              )
                            }{" "}
                            item(s)
                          </p>

                          <small>
                            Held{" "}
                            {new Date(
                              heldSale.heldAt
                            ).toLocaleTimeString()}
                          </small>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            restoreHeldSale(
                              heldSale.id
                            )
                          }
                        >
                          Restore Sale
                        </button>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {loading ? (
              <div
                className="catalogue-message"
                role="status"
                aria-live="polite"
              >
                <span
                  className="loading-indicator"
                  aria-hidden="true"
                />

                <p>
                  Loading products...
                </p>
              </div>
            ) : error ? (
              <div
                className="catalogue-message catalogue-message--error"
                role="alert"
              >
                <h2>
                  Products couldn’t be
                  loaded
                </h2>

                <p>{error}</p>
              </div>
            ) : products.length ===
              0 ? (
              <div className="catalogue-message">
                <h2>
                  No products available
                </h2>

                <p>
                  There are no matching
                  products to display
                  right now.
                </p>
              </div>
            ) : filteredProducts.length ===
              0 ? (
              <div className="catalogue-message">
                <h2>
                  {view ===
                  "low-stock"
                    ? "No low-stock products"
                    : "No products match your search"}
                </h2>

                <button
                  className="clear-filters-button"
                  onClick={
                    clearFilters
                  }
                >
                  {view ===
                  "low-stock"
                    ? "Show all products"
                    : "Clear filters"}
                </button>
              </div>
            ) : (
              <>
                <div className={`catalogue-layout${view === "low-stock" ? " catalogue-layout--products-only" : ""}`}>
                <div className="catalogue-panel">
                  <p className="catalogue-summary">
                    {view ===
                    "low-stock"
                      ? `${filteredProducts.length} low-stock products`
                      : `${filteredProducts.length} products match your search and filters`}
                  </p>

                  <ProductList
                    products={
                      pagedProducts
                    }
                    cart={cart}
                    showStock={
                      view ===
                      "low-stock"
                    }
                    readOnly={view === "low-stock"}
                    onAddToCart={(
                      product
                    ) =>
                      dispatch({
                        type: "ADD",
                        product,
                      })
                    }
                    onViewDetails={
                      handleViewDetails
                    }
                  />
                  <ProductPagination
                    currentPage={currentProductPage}
                    pageSize={productPageSize}
                    totalItems={filteredProducts.length}
                    pageSizeOptions={[12, 20, 50]}
                    onPageChange={setProductPage}
                    onPageSizeChange={(size) => {
                      setProductPageSize(size);
                      setProductPage(1);
                    }}
                  />
                </div>
                {view !== "low-stock" && <Cart
                  items={cart}
                  onIncrement={(
                    id
                  ) =>
                    dispatch({
                      type: "INCREMENT",
                      id,
                    })
                  }
                  onDecrement={(
                    id
                  ) =>
                    dispatch({
                      type: "DECREMENT",
                      id,
                    })
                  }
                  onRemove={(id) =>
                    dispatch({
                      type: "REMOVE",
                      id,
                    })
                  }
                  onClear={() =>
                    dispatch({
                      type: "CLEAR",
                    })
                  }
                  onCheckout={() => {
                    setCheckoutError("");
                    setCheckoutOpen(true);
                  }}
                  checkoutDisabled={!cashierShift}
                  onHoldSale={
                    holdSale
                  }
                />}
                {checkoutOpen && view !== "low-stock" && (
                  <CheckoutDialog
                    totalKsh={toKsh(cart.reduce(
                      (sum, item) => sum + Number(item.price) * item.quantity,
                      0
                    ))}
                    error={checkoutError}
                    onCancel={() => {
                      setCheckoutOpen(false);
                      setCheckoutError("");
                    }}
                    onComplete={completeSale}
                  />
                )}
              </div>
              </>
            )}

            {selectedProduct && (
              <ProductDetails
                product={selectedProduct}
                anchorElement={selectedProductAnchor}
                onClose={closeProductDetails}
                onAddToCart={(product) => dispatch({ type: "ADD", product })}
                readOnly={view === "low-stock"}
              />
            )}
          </section>
        </main>
      )}

      {printOrder && (
        <section className="history-print-receipt" aria-label="Printable sales receipt">
          <header>
            <h1>TechPoint POS</h1>
            <p>Sales receipt</p>
          </header>
          <hr />
          <p><strong>Receipt:</strong> {printOrder.receiptNumber}</p>
          <p><strong>Order:</strong> {printOrder.orderId}</p>
          <p><strong>Date:</strong> {new Date(printOrder.createdAt).toLocaleString()}</p>
          <p><strong>Cashier:</strong> {printOrder.cashier?.name || printOrder.cashier || "—"}</p>
          <p><strong>Payment:</strong> {printOrder.paymentMethod}</p>
          <hr />
          <ul>
            {printOrder.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.quantity} × {formatKsh(item.unitPriceKsh)}</small>
                </div>
                <strong>{formatKsh(item.lineTotalKsh)}</strong>
              </li>
            ))}
          </ul>
          <hr />
          <p className="history-print-total"><strong>Total</strong><strong>{formatKsh(printOrder.totalKsh)}</strong></p>
          {printOrder.amountTenderedKsh != null && (
            <>
              <p><strong>Cash received:</strong> {formatKsh(printOrder.amountTenderedKsh)}</p>
              <p><strong>Change:</strong> {formatKsh(printOrder.changeGivenKsh)}</p>
            </>
          )}
          {printOrder.returns.length > 0 && (
            <>
              <hr />
              <p><strong>Refunds:</strong> {formatKsh(printOrder.returns.reduce((sum, refund) => sum + refund.refundTotalKsh, 0))}</p>
              <p><strong>Net after refunds:</strong> {formatKsh(printOrder.netAfterRefundsKsh)}</p>
            </>
          )}
          <hr />
          <p className="history-print-thanks">Thank you for shopping with us.</p>
        </section>
      )}
    </div>
  );
}

function AppWithRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="*"
          element={<App />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppWithRouter;
