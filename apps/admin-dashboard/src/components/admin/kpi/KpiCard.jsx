import StatCard from '../../common/StatCard.jsx';
import KpiTrend from './KpiTrend.jsx';

function KpiCard({ label, value, trend }) {
  return (
    <StatCard label={label} value={value}>
      {trend && <KpiTrend values={trend} />}
    </StatCard>
  );
}

export default KpiCard;
