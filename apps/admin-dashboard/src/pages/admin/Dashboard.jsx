import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import KpiGrid from '../../components/admin/kpi/KpiGrid.jsx';
import StatCard from '../../components/common/StatCard.jsx';

import { rideService } from '../../services/ride.service.js';
import { driverService } from '../../services/driver.service.js';
import { userService } from '../../services/user.service.js';
import { paymentService } from '../../services/payment.service.js';

import { useToast } from '../../hooks/useToast.js';

const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

const DATE_PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày gần nhất' },
  { value: '30d', label: '30 ngày gần nhất' },
  { value: 'custom', label: 'Tùy chọn' }
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function resolvePresetRange(preset) {
  const now = new Date();
  if (preset === 'today') {
    return { start: startOfDay(now), end: now };
  }

  if (preset === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: startOfDay(start), end: now };
  }

  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { start: startOfDay(start), end: now };
}

function toRangeLabel(range) {
  if (!range?.start || !range?.end) {
    return 'N/A';
  }

  const start = range.start.toLocaleDateString('vi-VN');
  const end = range.end.toLocaleDateString('vi-VN');
  return start === end ? start : `${start} - ${end}`;
}

function toRideStatus(status) {
  return String(status || '').toLowerCase();
}

function toPaymentStatus(status) {
  return String(status || '').toUpperCase();
}

function getPaymentCreatedAt(payment) {
  return payment?.createdAt || payment?.created_at || payment?.updatedAt || payment?.updated_at || payment?.paidAt || payment?.paid_at || null;
}

function isInRange(value, range) {
  if (!range?.start || !range?.end) return false;
  const d = parseDateTime(value);
  if (!d) return false;
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [datePreset, setDatePreset] = useState('7d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [snapshot, setSnapshot] = useState({
    rides: [],
    drivers: [],
    users: [],
    payments: []
  });

  useEffect(() => {
    const presetRange = resolvePresetRange('7d');
    setFromDate(toDateInputValue(presetRange.start));
    setToDate(toDateInputValue(presetRange.end));
  }, []);

  useEffect(() => {
    if (datePreset === 'custom') return;
    const presetRange = resolvePresetRange(datePreset);
    setFromDate(toDateInputValue(presetRange.start));
    setToDate(toDateInputValue(presetRange.end));
  }, [datePreset]);

  const dateRange = useMemo(() => {
    if (datePreset !== 'custom') {
      return resolvePresetRange(datePreset);
    }

    if (!fromDate || !toDate) {
      return null;
    }

    const start = startOfDay(`${fromDate}T00:00:00`);
    const end = endOfDay(`${toDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
      return null;
    }

    return { start, end };
  }, [datePreset, fromDate, toDate]);

  const invalidCustomRange = datePreset === 'custom' && Boolean(fromDate && toDate) && !dateRange;

  const fetchPaged = useCallback(async (listFn, baseParams = {}) => {
    let cursor = null;
    let page = 0;
    const allItems = [];

    while (page < MAX_PAGES) {
      const params = {
        ...baseParams,
        limit: PAGE_LIMIT,
        ...(cursor ? { cursor } : {})
      };

      const result = await listFn(params);
      const items = Array.isArray(result?.items) ? result.items : [];
      allItems.push(...items);

      cursor = result?.nextCursor || null;
      page += 1;

      if (!cursor || items.length === 0) {
        break;
      }
    }

    return allItems;
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);

    try {
      const results = await Promise.allSettled([
        fetchPaged((params) => rideService.list(params), { sort: '-createdAt' }),
        driverService.list({}),
        userService.list({}),
        fetchPaged((params) => paymentService.list(params), { sort: '-createdAt' })
      ]);

      const [ridesResult, driversResult, usersResult, paymentsResult] = results;

      const nextSnapshot = {
        rides: ridesResult.status === 'fulfilled' ? ridesResult.value || [] : [],
        drivers: driversResult.status === 'fulfilled' ? driversResult.value.items || [] : [],
        users: usersResult.status === 'fulfilled' ? usersResult.value.items || [] : [],
        payments: paymentsResult.status === 'fulfilled' ? paymentsResult.value || [] : []
      };

      if (ridesResult.status === 'rejected') {
        toast?.push(ridesResult.reason?.message || 'Không thể tải chuyến đi', 'danger');
      }

      if (driversResult.status === 'rejected') {
        toast?.push(driversResult.reason?.message || 'Không thể tải tài xế', 'danger');
      }

      if (usersResult.status === 'rejected') {
        toast?.push(usersResult.reason?.message || 'Không thể tải người dùng', 'danger');
      }

      if (paymentsResult.status === 'rejected') {
        toast?.push(paymentsResult.reason?.message || 'Không thể tải thanh toán', 'danger');
      }

      setSnapshot(nextSnapshot);
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [fetchPaged, toast]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const metrics = useMemo(() => {
    const rides = snapshot.rides || [];
    const drivers = snapshot.drivers || [];
    const users = snapshot.users || [];
    const payments = snapshot.payments || [];

    const ridesInRange = dateRange ? rides.filter((ride) => isInRange(ride.createdAt, dateRange)) : [];
    const paymentsInRange = dateRange ? payments.filter((payment) => isInRange(getPaymentCreatedAt(payment), dateRange)) : [];

    const completedRides = ridesInRange.filter((ride) => toRideStatus(ride.status) === 'completed');
    const cancelledRides = ridesInRange.filter((ride) => toRideStatus(ride.status) === 'cancelled');

    const completedWithTimes = completedRides.filter((ride) => ride.createdAt && ride.statusUpdatedAt);

    const avgEta =
      completedWithTimes.length === 0
        ? 0
        : completedWithTimes.reduce((sum, ride) => {
            const start = parseDateTime(ride.createdAt);
            const end = parseDateTime(ride.statusUpdatedAt);
            if (!start || !end) return sum;
            return sum + Math.max(0, end.getTime() - start.getTime());
          }, 0) /
          completedWithTimes.length /
          60000;

    const paidPayments = paymentsInRange.filter((payment) => toPaymentStatus(payment.status) === 'PAID');

    const avgFare =
      paidPayments.length === 0
        ? 0
        : paidPayments.reduce((sum, payment) => {
            const amount = Number(payment.amount || 0);
            return sum + (Number.isFinite(amount) ? amount : 0);
          }, 0) / paidPayments.length;

    const paymentSuccess = paymentsInRange.length === 0 ? 0 : (paidPayments.length / paymentsInRange.length) * 100;

    const activeDrivers = drivers.filter((driver) => String(driver.onlineStatus || '').toUpperCase() === 'ONLINE').length;
    const busyDrivers = drivers.filter((driver) => String(driver.onlineStatus || '').toUpperCase() === 'BUSY').length;

    const activeUsers = users.filter((user) => String(user.status || '').toUpperCase() === 'ACTIVE').length;
    const suspendedUsers = users.filter((user) => String(user.status || '').toUpperCase() === 'SUSPENDED').length;

    return {
      ridesInRangeCount: ridesInRange.length,
      completedCount: completedRides.length,
      cancelledCount: cancelledRides.length,
      activeDrivers,
      busyDrivers,
      activeUsers,
      suspendedUsers,
      avgEta,
      avgFare,
      paymentSuccess
    };
  }, [snapshot, dateRange]);

  const buildTrend = (value) => {
    const base = Number.isFinite(value) && value > 0 ? value : 1;
    return [0.6, 0.72, 0.85, 0.95, 1, 0.9].map((factor) => Math.max(1, Math.round(base * factor)));
  };

  const periodLabel = toRangeLabel(dateRange);
  const updateLabel = lastUpdatedAt ? lastUpdatedAt.toLocaleString('vi-VN') : 'Chưa có dữ liệu cập nhật';

  const kpis = [
    {
      label: `Chuyến đi (${periodLabel})`,
      value: metrics.ridesInRangeCount,
      trend: buildTrend(metrics.ridesInRangeCount)
    },
    {
      label: `Hoàn thành (${periodLabel})`,
      value: metrics.completedCount,
      trend: buildTrend(metrics.completedCount)
    },
    {
      label: `Đã hủy (${periodLabel})`,
      value: metrics.cancelledCount,
      trend: buildTrend(metrics.cancelledCount)
    },
    {
      label: 'Tài xế online',
      value: metrics.activeDrivers,
      trend: buildTrend(metrics.activeDrivers)
    }
  ];

  const handleResetRange = () => {
    setDatePreset('7d');
  };

  return (
    <div className="dashboard-shell">
      <PageHeader title="Tổng quan" subtitle="Trung tâm điều hành theo thời gian thực cho vận hành, cung ứng và thanh toán." />

      <div className="card dashboard-control-card">
        <div className="dashboard-control-head">
          <div>
            <h3 className="card-title">Bộ lọc & thao tác nhanh</h3>
            <div className="dashboard-control-subtitle">Thiết lập phạm vi báo cáo và điều hướng nhanh tới các module xử lý.</div>
          </div>

          <div className="dashboard-control-actions">
            <Button variant="outline" onClick={loadSnapshot} disabled={loading}>
              {loading ? 'Đang tải...' : 'Làm mới dữ liệu'}
            </Button>
            <Button variant="primary" onClick={() => navigate('/admin/monitoring')}>
              Mở giám sát
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/pricing')}>
              Điều chỉnh giá
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin/rides')}>
              Tìm chuyến đi
            </Button>
          </div>
        </div>

        <div className="dashboard-filter-grid">
          <Select label="Khoảng thời gian" value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
            {DATE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </Select>

          <Input
            label="Từ ngày"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            disabled={datePreset !== 'custom'}
          />

          <Input
            label="Đến ngày"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            disabled={datePreset !== 'custom'}
          />

          <div className="dashboard-filter-reset">
            <Button variant="ghost" onClick={handleResetRange}>
              Đặt lại 7 ngày
            </Button>
          </div>
        </div>

        <div className="dashboard-meta-row">
          <span className="badge info">Khoảng báo cáo: {periodLabel}</span>
          <span className="badge warning">Lần cập nhật: {updateLabel}</span>
        </div>

        {invalidCustomRange && <div className="dashboard-warning">Khoảng ngày không hợp lệ. Từ ngày phải nhỏ hơn hoặc bằng đến ngày.</div>}
      </div>

      <section className="dashboard-section">
        <h3 className="dashboard-section-title">KPI chính</h3>
        <KpiGrid items={kpis} />
      </section>

      <section className="dashboard-section">
        <h3 className="dashboard-section-title">Hiệu suất vận hành</h3>
        <div className="grid grid-3">
          <StatCard label="ETA trung bình" value={loading ? '--' : `${metrics.avgEta.toFixed(1)} phút`} />
          <StatCard label="Cước phí trung bình" value={loading ? '--' : `${Math.round(metrics.avgFare).toLocaleString()} VND`} />
          <StatCard label="Tỷ lệ thanh toán thành công" value={loading ? '--' : `${metrics.paymentSuccess.toFixed(1)}%`} />
        </div>
      </section>

      <section className="dashboard-section">
        <h3 className="dashboard-section-title">Năng lực hệ thống</h3>
        <div className="grid grid-4">
          <StatCard label="Tài xế online" value={loading ? '--' : metrics.activeDrivers} />
          <StatCard label="Tài xế đang bận" value={loading ? '--' : metrics.busyDrivers} />
          <StatCard label="Người dùng active" value={loading ? '--' : metrics.activeUsers} />
          <StatCard label="Người dùng tạm khóa" value={loading ? '--' : metrics.suspendedUsers} />
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
