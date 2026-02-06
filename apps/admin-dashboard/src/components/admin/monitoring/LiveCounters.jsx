import StatCard from '../../common/StatCard.jsx'

function LiveCounters({ counters }) {
  const items = [
    { label: 'Active Drivers', value: counters?.activeDrivers || 0 },
    { label: 'Busy Drivers', value: counters?.busyDrivers || 0 },
    { label: 'Rides In Progress', value: counters?.ridesInProgress || 0 },
    { label: 'Alerts', value: counters?.alerts || 0 },
  ]

  return (
    <div className="grid grid-4">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  )
}

export default LiveCounters
