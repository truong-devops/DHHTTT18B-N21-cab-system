import StatCard from '../../common/StatCard.jsx';

function LiveCounters({ counters }) {
  const items = [
    { label: 'Tài xế hoạt động', value: counters?.activeDrivers || 0 },
    { label: 'Tài xế đang bận', value: counters?.busyDrivers || 0 },
    { label: 'Chuyến đang diễn ra', value: counters?.ridesInProgress || 0 },
    { label: 'Cảnh báo', value: counters?.alerts || 0 }
  ];

  return (
    <div className="grid grid-4">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

export default LiveCounters;
