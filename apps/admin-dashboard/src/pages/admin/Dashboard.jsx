import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/common/Button.jsx'
import PageHeader from '../../components/common/PageHeader.jsx'
import KpiGrid from '../../components/admin/kpi/KpiGrid.jsx'
import StatCard from '../../components/common/StatCard.jsx'
import { rideService } from '../../services/ride.service.js'
import { driverService } from '../../services/driver.service.js'
import { userService } from '../../services/user.service.js'
import { paymentService } from '../../services/payment.service.js'
import { useToast } from '../../hooks/useToast.js'

function Dashboard() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState({
    rides: [],
    drivers: [],
    users: [],
    payments: [],
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          rideService.list({ limit: 100 }),
          driverService.list({}),
          userService.list({}),
          paymentService.list({ limit: 100 }),
        ])

        if (!mounted) return

        const [ridesResult, driversResult, usersResult, paymentsResult] = results
        const nextSnapshot = {
          rides:
            ridesResult.status === 'fulfilled'
              ? ridesResult.value.items || []
              : [],
          drivers:
            driversResult.status === 'fulfilled'
              ? driversResult.value.items || []
              : [],
          users:
            usersResult.status === 'fulfilled'
              ? usersResult.value.items || []
              : [],
          payments:
            paymentsResult.status === 'fulfilled'
              ? paymentsResult.value.items || []
              : [],
        }

        if (ridesResult.status === 'rejected') {
          toast?.push(
            ridesResult.reason?.message || 'Không thể tải chuyến đi',
            'danger'
          )
        }
        if (driversResult.status === 'rejected') {
          toast?.push(
            driversResult.reason?.message || 'Không thể tải tài xế',
            'danger'
          )
        }
        if (usersResult.status === 'rejected') {
          toast?.push(
            usersResult.reason?.message || 'Không thể tải người dùng',
            'danger'
          )
        }
        if (paymentsResult.status === 'rejected') {
          toast?.push(
            paymentsResult.reason?.message || 'Không thể tải thanh toán',
            'danger'
          )
        }

        setSnapshot(nextSnapshot)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const metrics = useMemo(() => {
    const rides = snapshot.rides
    const drivers = snapshot.drivers
    const payments = snapshot.payments

    const windowDays = 7
    const windowMs = windowDays * 24 * 60 * 60 * 1000
    const windowStart = Date.now() - windowMs

    const isInWindow = (value) => {
      if (!value) return false
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return false
      return date.getTime() >= windowStart
    }

    const ridesWindow = rides.filter((ride) => isInWindow(ride.createdAt))
    const ridesToday = ridesWindow.length
    const completed = ridesWindow.filter(
      (ride) => ride.status === 'completed'
    ).length
    const cancelled = ridesWindow.filter(
      (ride) => ride.status === 'cancelled'
    ).length
    const activeDrivers = drivers.filter(
      (driver) => driver.onlineStatus === 'ONLINE'
    ).length

    const completedRides = ridesWindow.filter(
      (ride) => ride.status === 'completed' && ride.createdAt && ride.statusUpdatedAt
    )
    const avgEta =
      completedRides.length === 0
        ? 0
        : completedRides.reduce((sum, ride) => {
            const start = new Date(ride.createdAt).getTime()
            const end = new Date(ride.statusUpdatedAt).getTime()
            if (Number.isNaN(start) || Number.isNaN(end)) return sum
            return sum + Math.max(0, end - start)
          }, 0) /
          completedRides.length /
          60000

    const paidPayments = payments.filter((payment) => payment.status === 'PAID')
    const avgFare =
      paidPayments.length === 0
        ? 0
        : paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) /
          paidPayments.length

    const paymentSuccess =
      payments.length === 0
        ? 0
        : (paidPayments.length / payments.length) * 100

    return {
      windowDays,
      ridesToday,
      completed,
      cancelled,
      activeDrivers,
      avgEta,
      avgFare,
      paymentSuccess,
    }
  }, [snapshot])

  const buildTrend = (value) => {
    const base = Number.isFinite(value) && value > 0 ? value : 1
    return [0.6, 0.72, 0.85, 0.95, 1, 0.9].map((factor) =>
      Math.max(1, Math.round(base * factor))
    )
  }

  const kpis = [
    {
      label: `Chuyến đi (${metrics.windowDays} ngày)`,
      value: metrics.ridesToday,
      trend: buildTrend(metrics.ridesToday),
    },
    {
      label: `Hoàn thành (${metrics.windowDays} ngày)`,
      value: metrics.completed,
      trend: buildTrend(metrics.completed),
    },
    {
      label: `Đã hủy (${metrics.windowDays} ngày)`,
      value: metrics.cancelled,
      trend: buildTrend(metrics.cancelled),
    },
    {
      label: 'Tài xế hoạt động',
      value: metrics.activeDrivers,
      trend: buildTrend(metrics.activeDrivers),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        subtitle="Tổng quan thời gian thực về chuyến đi, nhu cầu và tình trạng tài xế."
      />
      <KpiGrid items={kpis} />
      <div className="grid grid-3">
        <StatCard
          label="ETA trung bình"
          value={loading ? '--' : `${metrics.avgEta.toFixed(1)} phút`}
        />
        <StatCard
          label="Cước phí trung bình"
          value={loading ? '--' : `${Math.round(metrics.avgFare).toLocaleString()} VND`}
        />
        <StatCard
          label="Tỷ lệ thanh toán thành công"
          value={loading ? '--' : `${metrics.paymentSuccess.toFixed(1)}%`}
        />
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Thao tác nhanh</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary">Mở màn hình giám sát</Button>
          <Button variant="outline">Điều chỉnh tăng giá</Button>
          <Button variant="ghost">Tìm chuyến đi</Button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
