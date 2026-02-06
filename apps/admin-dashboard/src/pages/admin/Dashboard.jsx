import Button from '../../components/common/Button.jsx'
import KpiGrid from '../../components/admin/kpi/KpiGrid.jsx'
import StatCard from '../../components/common/StatCard.jsx'

function Dashboard() {
  const kpis = [
    { label: 'Rides Today', value: 1280, trend: [2, 4, 5, 6, 8, 9] },
    { label: 'Completed', value: 1094, trend: [3, 4, 6, 7, 8, 9] },
    { label: 'Cancelled', value: 43, trend: [1, 1, 2, 1, 2, 1] },
    { label: 'Active Drivers', value: 342, trend: [5, 6, 7, 8, 9, 10] },
  ]

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <KpiGrid items={kpis} />
      <div className="grid grid-3">
        <StatCard label="Avg ETA" value="6.2 min" />
        <StatCard label="Avg Fare" value="92,000 VND" />
        <StatCard label="Payment Success" value="98.4%" />
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary">Go to Monitoring</Button>
          <Button variant="outline">Adjust Surge</Button>
          <Button variant="ghost">Search Ride</Button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
