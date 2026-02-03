import KpiCard from './KpiCard.jsx'

function KpiGrid({ items = [] }) {
  return (
    <div className="grid grid-4">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}

export default KpiGrid
