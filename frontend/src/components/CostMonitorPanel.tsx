import { useApi } from "../hooks/useApi";
import { getBillingSummary } from "../services/dashboardService";
import StatusBadge from "./StatusBadge";

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function CostMonitorPanel() {
  const { data, loading, error } = useApi(getBillingSummary);

  return (
    <section className="panel">
      <div className="billing-header">
        <div>
          <h2>AWS Cost Monitoring</h2>
          {data && (
            <span className="billing-period">
              Billing period: {data.periodStart} to {data.periodEnd}
            </span>
          )}
        </div>
        {data && (
          <StatusBadge
            label={data.source === "aws" ? "AWS Cost Explorer" : "Mock Preview"}
            tone={data.source === "aws" ? "ok" : "info"}
          />
        )}
      </div>

      {loading && <p className="state-message">Loading billing summary...</p>}
      {error && <p className="state-message">Could not load billing summary: {error}</p>}

      {data && (
        <>
          <div className="billing-kpis">
            <div className="stat-card">
              <div className="label">Current Month Spend</div>
              <div className="value">
                {formatCurrency(data.currentMonthSpend, data.currency)}
              </div>
            </div>
            <div className="stat-card warn">
              <div className="label">Forecasted Month-End Spend</div>
              <div className="value">
                {formatCurrency(data.forecastedSpend, data.currency)}
              </div>
            </div>
          </div>

          <h3 className="billing-subheading">Service Breakdown</h3>
          {data.serviceBreakdown.length === 0 ? (
            <p className="state-message">No service charges recorded for this period yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>AWS Service</th>
                    <th>Spend</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.serviceBreakdown.map((item) => (
                    <tr key={item.service}>
                      <td>{item.service}</td>
                      <td className="billing-amount">
                        {formatCurrency(item.amount, item.currency)}
                      </td>
                      <td>
                        <div className="usage">
                          <div className="usage-track">
                            <div
                              className="usage-fill billing-bar"
                              style={{ width: `${Math.min(item.percentage, 100)}%` }}
                            />
                          </div>
                          <span>{item.percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

