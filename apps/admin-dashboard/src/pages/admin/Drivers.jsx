import { useCallback, useEffect, useState } from 'react';

import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/common/Select.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';

import DriverTable from '../../components/admin/drivers/DriverTable.jsx';
import DriverDetailDrawer from '../../components/admin/drivers/DriverDetailDrawer.jsx';

import { authService } from '../../services/auth.service.js';
import { driverService } from '../../services/driver.service.js';

import { useToast } from '../../hooks/useToast.js';

function pickRegisteredUserId(payload) {
  return payload?.data?.id || payload?.data?.user_id || payload?.id || payload?.userId || null;
}

function Drivers() {
  const toast = useToast();

  const [filters, setFilters] = useState({
    status: '',
    onlineStatus: '',
    vehicleType: ''
  });

  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: ''
  });

  const loadDrivers = useCallback(async () => {
    try {
      const result = await driverService.list({
        status: filters.status || undefined,
        onlineStatus: filters.onlineStatus || undefined,
        vehicleType: filters.vehicleType || undefined
      });

      setDrivers(result.items || []);
    } catch (error) {
      toast?.push(error.message || 'Không thể tải tài xế', 'danger');
    }
  }, [filters.status, filters.onlineStatus, filters.vehicleType, toast]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const handleApprove = async (driver) => {
    try {
      await driverService.approve(driver.id);
      setDrivers((prev) => prev.map((item) => (item.id === driver.id ? { ...item, status: 'APPROVED' } : item)));
      toast?.push('Đã duyệt tài xế', 'success');
    } catch (error) {
      toast?.push(error.message || 'Không thể duyệt tài xế', 'danger');
    }
  };

  const handleSuspend = async (driver) => {
    try {
      await driverService.suspend(driver.id);
      setDrivers((prev) => prev.map((item) => (item.id === driver.id ? { ...item, status: 'SUSPENDED', onlineStatus: 'OFFLINE' } : item)));
      toast?.push('Đã tạm khóa tài xế', 'warning');
    } catch (error) {
      toast?.push(error.message || 'Không thể tạm khóa tài xế', 'danger');
    }
  };

  const handleCreateDriverAccount = async () => {
    const email = createForm.email.trim();
    const password = createForm.password;
    const fullName = createForm.fullName.trim();
    const phone = createForm.phone.trim();

    if (!email || !password) {
      toast?.push('Email và mật khẩu là bắt buộc', 'warning');
      return;
    }

    if (password.length < 6) {
      toast?.push('Mật khẩu phải có ít nhất 6 ký tự', 'warning');
      return;
    }

    let registeredUserId = null;
    setCreating(true);

    try {
      const registerResult = await authService.register({
        email,
        password,
        role: 'driver'
      });

      registeredUserId = pickRegisteredUserId(registerResult);
      if (!registeredUserId) {
        throw new Error('Không lấy được userId từ auth-service');
      }

      const createResult = await driverService.create({
        userId: registeredUserId,
        fullName: fullName || undefined,
        phone: phone || undefined
      });

      const createdDriver = createResult?.driver || null;
      if (createdDriver) {
        setDrivers((prev) => {
          if (prev.some((item) => item.id === createdDriver.id)) return prev;
          return [createdDriver, ...prev];
        });
      } else {
        await loadDrivers();
      }

      toast?.push('Đã tạo tài khoản tài xế', 'success');
      setCreateOpen(false);
      setCreateForm({ email: '', password: '', fullName: '', phone: '' });
    } catch (error) {
      const message = error?.message || 'Không thể tạo tài khoản tài xế';
      if (registeredUserId) {
        toast?.push(`${message}. Có thể tài khoản auth đã được tạo với userId=${registeredUserId}.`, 'warning');
      } else {
        toast?.push(message, 'danger');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader title="Tài xế" subtitle="Xác thực hồ sơ, tuân thủ và trạng thái sẵn sàng.">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Tạo tài khoản tài xế
        </Button>
      </PageHeader>

      <div className="card">
        <div className="grid grid-3">
          <Select label="Trạng thái" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PENDING">Chờ duyệt</option>
          </Select>

          <Select
            label="Trực tuyến"
            value={filters.onlineStatus}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                onlineStatus: event.target.value
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="ONLINE">Trực tuyến</option>
            <option value="OFFLINE">Ngoại tuyến</option>
          </Select>

          <Select
            label="Phương tiện"
            value={filters.vehicleType}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                vehicleType: event.target.value
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="CAR">Ô tô</option>
            <option value="BIKE">Xe máy</option>
          </Select>
        </div>
      </div>

      <div className="card">
        <DriverTable drivers={drivers} onSelect={setSelected} onApprove={handleApprove} onSuspend={handleSuspend} />
      </div>

      <DriverDetailDrawer driver={selected} onClose={() => setSelected(null)} />

      {createOpen && (
        <Modal title="Tạo tài khoản tài xế" onClose={() => !creating && setCreateOpen(false)}>
          <div className="grid grid-2">
            <Input
              label="Email đăng nhập"
              type="email"
              placeholder="driver@example.com"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            />

            <Input
              label="Mật khẩu tạm"
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
            />

            <Input
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              value={createForm.fullName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />

            <Input
              label="Số điện thoại"
              placeholder="0901234567"
              value={createForm.phone}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>

          <div className="input-helper" style={{ marginTop: 8 }}>
            Hệ thống sẽ tạo tài khoản đăng nhập (auth-service, role=driver) và hồ sơ tài xế (driver-service).
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleCreateDriverAccount} disabled={creating}>
              {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Drivers;
