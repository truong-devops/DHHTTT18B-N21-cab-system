import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader.jsx'
import LiveCounters from '../../components/admin/monitoring/LiveCounters.jsx'
import LiveMap from '../../components/admin/monitoring/LiveMap.jsx'
import { monitoringService } from '../../services/monitoring.service.js'
import { usePolling } from '../../hooks/usePolling.js'

function Monitoring() {
  const [counters, setCounters] = useState(null)
  const [markers, setMarkers] = useState([])

  const load = useCallback(async () => {
    const [nextCounters, nextMarkers] = await Promise.all([
      monitoringService.getCounters(),
      monitoringService.getMapSnapshot(),
    ])
    setCounters(nextCounters)
    setMarkers(nextMarkers)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  usePolling(load, 4000)

  return (
    <div>
      <PageHeader
        title="Monitoring"
        subtitle="Live pulse of dispatch, supply, and rider demand."
      />
      <LiveCounters counters={counters} />
      <LiveMap markers={markers} />
    </div>
  )
}

export default Monitoring
