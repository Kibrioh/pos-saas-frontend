import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatKsh, toKsh, USD_TO_KSH } from "../utils/formatPrice";
import { showManagerSuccess } from "../utils/managerToast";

function cashDifferenceLabel(value) {
  const difference = Number(value || 0);
  const amount = toKsh(Math.abs(difference));
  if (!amount) return "Balanced";
  return difference > 0
    ? `Over by ${formatKsh(amount)}`
    : `Short by ${formatKsh(amount)}`;
}

function ManagerShifts() {
  const [shifts, setShifts] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [cashierId, setCashierId] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [movementShiftId, setMovementShiftId] = useState("");
  const [movementDirection, setMovementDirection] = useState("out");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [movementError, setMovementError] = useState("");
  const [movementSuccess, setMovementSuccess] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [closingShiftId, setClosingShiftId] = useState(null);
  const [closingCash, setClosingCash] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingError, setClosingError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [shiftData, userData] = await Promise.all([
        apiFetch("/shifts"),
        apiFetch("/auth/users?role=cashier"),
      ]);
      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setCashiers(
        (userData.users || []).filter(
          (user) => String(user.role || "").trim().toLowerCase() === "cashier"
        )
      );
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch("/shifts"),
      apiFetch("/auth/users?role=cashier"),
    ])
      .then(([shiftData, userData]) => {
        if (!active) return;
        setShifts(Array.isArray(shiftData) ? shiftData : []);
        setCashiers(
          (userData.users || []).filter(
            (user) => String(user.role || "").trim().toLowerCase() === "cashier"
          )
        );
        setLoadError("");
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message || "Could not load cashier shifts.");
      });

    return () => {
      active = false;
    };
  }, []);

  const openCashierIds = new Set(
    shifts.filter((shift) => shift.status === "open").map((shift) => shift.user_id)
  );

  const assignFloat = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/shifts/assign", {
        method: "POST",
        body: JSON.stringify({
          cashier_id: Number(cashierId),
          opening_cash: Number(openingFloat) / USD_TO_KSH,
        }),
      });
      setCashierId("");
      setOpeningFloat("");
      await reload();
      showManagerSuccess("Cashier float assigned successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const recordCashMovement = async (event) => {
    event.preventDefault();
    setMovementError("");
    setMovementSuccess("");
    setBusy(true);
    try {
      await apiFetch(`/shifts/${movementShiftId}/cash-movements`, {
        method: "POST",
        body: JSON.stringify({
          direction: movementDirection,
          amount: Number(movementAmount) / USD_TO_KSH,
          note: movementNote,
        }),
      });
      setMovementAmount("");
      setMovementNote("");
      await reload();
      setMovementSuccess("Till adjustment recorded. Updated expected till cash is shown below; the cashier can see it after refreshing their till panel.");
      showManagerSuccess("Till adjustment recorded successfully.");
    } catch (err) {
      setMovementError(err.message);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const closeShift = async (event, shift) => {
    event.preventDefault();
    setClosingBusy(true);
    setClosingError("");
    try {
      await apiFetch(`/shifts/${shift.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_cash: Number(closingCash) / USD_TO_KSH }),
      });
      setClosingShiftId(null);
      setClosingCash("");
      await reload();
      showManagerSuccess(`Shift #${shift.id} closed successfully.`);
    } catch (requestError) {
      setClosingError(requestError.message || "Could not close this shift.");
    } finally {
      setClosingBusy(false);
    }
  };

  const openShifts = shifts.filter((shift) => shift.status === "open");
  const selectedMovementShift = openShifts.find(
    (shift) => String(shift.id) === movementShiftId
  );
  const availableCashKsh = selectedMovementShift
    ? toKsh(selectedMovementShift.expected_cash)
    : 0;
  const cashOutExceedsBalance =
    movementDirection === "out"
    && Number(movementAmount || 0) > availableCashKsh;

  return (
    <main className="manager-content">
      <div className="manager-page-heading">
        <div><p className="manager-page-kicker">TILL CONTROL</p><h2>Cashier shifts</h2><p>Review opening floats, till adjustments, and closing cash totals.</p></div>
        <div className="inventory-summary"><strong>{shifts.filter((shift) => shift.status === "open").length}</strong><span>Open shifts</span></div>
      </div>

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Assign cashier float</h3><p>Choose a cashier and open their till with the cash float you hand them.</p></div></div>
        <form className="shift-inline-form shift-assign-form" onSubmit={assignFloat}>
          <label>
            Cashier
            <select value={cashierId} onChange={(event) => setCashierId(event.target.value)} required>
              <option value="">Select a cashier</option>
              {cashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id} disabled={openCashierIds.has(cashier.id)}>
                  {cashier.name}{openCashierIds.has(cashier.id) ? " · Shift already open" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opening float (KSh)
            <input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} placeholder="e.g. 2,000" required />
          </label>
          <button className="shift-open-button" disabled={busy || !cashierId}>
            {busy ? "Assigning…" : "Assign float & open shift"}
          </button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        {cashiers.length === 0 && !error && <p>No cashiers are registered yet.</p>}
      </section>

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Record till adjustment</h3><p>Use this only for cash added or removed outside normal sales and refunds. Cash sales are counted automatically, and this adjustment immediately updates expected till cash shown in Recent shifts.</p></div></div>
        <form className="shift-inline-form" onSubmit={recordCashMovement}>
          <label>
            Open till
            <select value={movementShiftId} onChange={(event) => setMovementShiftId(event.target.value)} required>
              <option value="">Select a cashier shift</option>
              {openShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.cashier || `User ${shift.user_id}`}</option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select value={movementDirection} onChange={(event) => {
              setMovementDirection(event.target.value);
              setMovementError("");
            }}>
              <option value="in">Cash added</option>
              <option value="out">Cash removed</option>
            </select>
          </label>
          <label>
            Amount (KSh)
            <input
              type="number"
              min="0.01"
              max={movementDirection === "out" ? availableCashKsh : undefined}
              step="0.01"
              value={movementAmount}
              onChange={(event) => {
                setMovementAmount(event.target.value);
                setMovementError("");
              }}
              required
            />
          </label>
          <label>
            Reason
            <input value={movementNote} onChange={(event) => setMovementNote(event.target.value)} maxLength="240" required />
          </label>
          <button className="button-secondary" disabled={busy || !movementShiftId || cashOutExceedsBalance}>
            {busy ? "Recording…" : "Record adjustment"}
          </button>
        </form>
        {movementSuccess && <p className="form-success" role="status">{movementSuccess}</p>}
        {movementDirection === "out" && selectedMovementShift && (
          <p className="shift-cash-available">Cash currently available: {formatKsh(availableCashKsh)}</p>
        )}
        {movementError && <p className="form-error" role="alert">{movementError}</p>}
        {cashOutExceedsBalance && (
          <p className="form-error" role="alert">Cash out cannot exceed the current till balance.</p>
        )}
        {openShifts.length === 0 && <p>There are no open shifts to adjust.</p>}
      </section>

      <section className="manager-section">
        <div className="section-heading-row"><div><h3>Open and recent shifts</h3><p>Reconcile and close open tills here; review completed cash counts below.</p></div><button className="button-secondary" type="button" onClick={reload} disabled={busy || closingBusy}>Refresh shifts</button></div>
        {loadError ? <p className="form-error" role="alert">{loadError}</p> : shifts.length === 0 ? <p>No shifts have been opened yet.</p> : (
          <div className="shift-list">
            {shifts.map((shift) => (
              <article className="shift-record" key={shift.id}>
                <div className="shift-record-main">
                  <div><h4>{shift.cashier || `User ${shift.user_id}`}</h4><p>Opened {new Date(shift.opened_at).toLocaleString()}</p>{shift.closed_at && <p>Closed {new Date(shift.closed_at).toLocaleString()}</p>}</div>
                  <span className={`shift-status${shift.status === "open" ? " is-open" : ""}`}>{shift.status}</span>
                </div>
                <div className="shift-record-values"><span>Assigned float <strong>{formatKsh(toKsh(shift.opening_cash))}</strong></span>{shift.status === "open" && <span>Expected till cash <strong>{formatKsh(toKsh(shift.expected_cash))}</strong></span>}{shift.status === "closed" && <><span>Expected till cash <strong>{formatKsh(toKsh(shift.expected_cash))}</strong></span><span>Counted cash <strong>{formatKsh(toKsh(shift.closing_cash))}</strong></span><span>Cash difference <strong>{cashDifferenceLabel(shift.cash_variance)}</strong></span></>}</div>
                {shift.status === "open" && (closingShiftId === shift.id ? (
                  <form className="shift-inline-form shift-close-form" onSubmit={(event) => closeShift(event, shift)}>
                    <label>
                      Counted cash (KSh)
                      <input type="number" min="0" step="0.01" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} required />
                    </label>
                    <div className="shift-close-actions">
                      <button className="shift-close-submit" type="submit" disabled={closingBusy}>
                        {closingBusy ? "Closing…" : "Reconcile & close shift"}
                      </button>
                      <button className="button-secondary" type="button" onClick={() => { setClosingShiftId(null); setClosingCash(""); setClosingError(""); }} disabled={closingBusy}>
                        Cancel
                      </button>
                    </div>
                    {closingError && <p className="form-error" role="alert">{closingError}</p>}
                  </form>
                ) : (
                  <button className="shift-close-button" type="button" onClick={() => { setClosingShiftId(shift.id); setClosingCash(""); setClosingError(""); }}>
                    Close shift
                  </button>
                ))}
                {shift.cash_movements?.length > 0 && <details className="shift-movements"><summary>{shift.cash_movements.length} till movements</summary><ul>{shift.cash_movements.map((movement) => <li key={movement.id}>{movement.direction === "in" ? "Cash in" : "Cash out"} · {formatKsh(toKsh(movement.amount))} · {movement.note}</li>)}</ul></details>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ManagerShifts;
