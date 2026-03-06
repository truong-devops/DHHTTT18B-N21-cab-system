import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'

import PageHeader from '../../components/common/PageHeader.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Select from '../../components/common/Select.jsx'
import Table from '../../components/common/Table.jsx'
import Badge from '../../components/common/Badge.jsx'

import { paymentService } from '../../services/payment.service.js'
import { useToast } from '../../hooks/useToast.js'
import { useAuth } from '../../hooks/useAuth.js'
import { labelFrom, paymentStatusLabels } from '../../utils/labels.js'

const DEFAULT_FORM = {
  rideId: 'ride_demo_001',
  userId: '',
  amount: '120000',
  currency: 'VND',
  method: 'PAYOS',
  note: 'Thanh toán thử',
}

function buildIdemKey() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `idem_${uuid}`
  }
  return `idem_${Date.now()}`
}

function decodeJwtPayload(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  try {
    const json = atob(padded)
    return JSON.parse(json)
  } catch (error) {
    return null
  }
}

function formatMoney(amount, currency = 'VND') {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return '-'
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(numeric)
  } catch (error) {
    return `${numeric} ${currency}`
  }
}

function PayosLogo() {
  return (
    <span className="pay-brand pay-brand-payos" aria-label="PayOS">
      <span className="pay-brand-payos-mark">P</span>
      <span>PayOS</span>
    </span>
  )
}

function VietQrLogo() {
  return (
    <span className="pay-brand pay-brand-vietqr" aria-label="VietQR">
      <span className="pay-brand-vietqr-mark" />
      <span className="pay-brand-vietqr-text">
        <span className="is-red">VIET</span>
        <span className="is-blue">QR</span>
      </span>
    </span>
  )
}

function Payments() {
  const toast = useToast()
  const { token: sessionToken } = useAuth() || {}
  const [form, setForm] = useState(DEFAULT_FORM)
  const [idempotencyKey, setIdempotencyKey] = useState(buildIdemKey)
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem('admin_token') || ''
  )
  const [loading, setLoading] = useState(false)
  const [loadingQr, setLoadingQr] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [payment, setPayment] = useState(null)
  const [payments, setPayments] = useState([])
  const [vietqr, setVietqr] = useState(null)
  const [qrFallback, setQrFallback] = useState('')
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [statusDrafts, setStatusDrafts] = useState({})
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [autoConfirmDelay, setAutoConfirmDelay] = useState(8)
  const autoConfirmTimerRef = useRef(null)

  useEffect(() => {
    if (sessionToken && !authToken) {
      setAuthToken(sessionToken)
    }
  }, [sessionToken, authToken])

  const tokenSubject = useMemo(() => {
    const payload = decodeJwtPayload(authToken.trim())
    if (!payload) return ''
    return payload.sub || payload.userId || payload.id || ''
  }, [authToken])

  useEffect(() => {
    if (tokenSubject && !form.userId) {
      setForm((prev) => ({ ...prev, userId: tokenSubject }))
    }
  }, [tokenSubject, form.userId])

  const loadPayments = useCallback(async () => {
    if (!authToken.trim()) {
      setPayments([])
      setListError('Chưa có token để tải danh sách thanh toán.')
      return
    }
    setLoadingList(true)
    setListError('')
    try {
      const result = await paymentService.list({ limit: 50 }, authToken.trim())
      setPayments(result.items || [])
      setStatusDrafts((prev) => {
        const next = { ...prev }
        ;(result.items || []).forEach((item) => {
          if (!next[item.id]) {
            next[item.id] = { status: item.status, failureReason: '' }
          }
        })
        return next
      })
    } catch (err) {
      setListError(err?.message || 'Không thể tải danh sách thanh toán')
    } finally {
      setLoadingList(false)
    }
  }, [authToken])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  useEffect(() => {
    if (autoConfirmTimerRef.current) {
      clearTimeout(autoConfirmTimerRef.current)
      autoConfirmTimerRef.current = null
    }

    if (!autoConfirm) return undefined
    if (!payment?.id || !authToken.trim()) return undefined
    if (['PAID', 'FAILED', 'REFUNDED'].includes(payment.status)) return undefined

    const delaySeconds = Math.max(1, Number(autoConfirmDelay) || 1)
    const targetId = payment.id

    autoConfirmTimerRef.current = setTimeout(async () => {
      try {
        const updated = await paymentService.confirmDev(
          targetId,
          authToken.trim()
        )
        if (updated) {
          setPayment(updated)
        }
        toast?.push('Đã tự xác nhận thanh toán (dev)', 'success')
      } catch (err) {
        const message = err?.message || 'Không thể xác nhận thanh toán'
        setError(message)
        toast?.push(message, 'danger')
      } finally {
        autoConfirmTimerRef.current = null
      }
    }, delaySeconds * 1000)

    return () => {
      if (autoConfirmTimerRef.current) {
        clearTimeout(autoConfirmTimerRef.current)
        autoConfirmTimerRef.current = null
      }
    }
  }, [autoConfirm, autoConfirmDelay, authToken, payment, toast])

  const nativeQrImage = useMemo(() => {
    if (vietqr?.qrUrl && String(vietqr.qrUrl).startsWith('data:image')) {
      return vietqr.qrUrl
    }
    if (
      payment?.payos?.qrCode &&
      String(payment.payos.qrCode).startsWith('data:image')
    ) {
      return payment.payos.qrCode
    }
    return ''
  }, [payment, vietqr])
  const qrImage = nativeQrImage || qrFallback

  const qrPayload = useMemo(() => {
    if (vietqr?.payload) return vietqr.payload
    if (payment?.payos?.qrCode && !nativeQrImage) return payment.payos.qrCode
    if (payment?.payos?.checkoutUrl) return payment.payos.checkoutUrl
    return ''
  }, [nativeQrImage, payment, vietqr])

  useEffect(() => {
    let mounted = true

    async function generateQr() {
      if (!qrPayload || nativeQrImage) {
        if (mounted) setQrFallback('')
        return
      }
      try {
        if (mounted) setQrFallback('')
        const dataUrl = await QRCode.toDataURL(qrPayload, {
          width: 220,
          margin: 1,
        })
        if (mounted) setQrFallback(dataUrl)
      } catch (error) {
        if (mounted) setQrFallback('')
      }
    }

    generateQr()

  return () => {
      mounted = false
    }
  }, [nativeQrImage, qrPayload])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!authToken.trim()) {
      const message = 'Chưa có token để gọi payment-service.'
      setError(message)
      toast?.push(message, 'danger')
      return
    }
    if (tokenSubject && form.userId.trim() && form.userId.trim() !== tokenSubject) {
      const message = `User ID phải trùng với token subject (${tokenSubject}).`
      setError(message)
      toast?.push(message, 'danger')
      return
    }
    setLoading(true)
    setError('')

    const idem = idempotencyKey.trim() || buildIdemKey()
    if (!idempotencyKey.trim()) {
      setIdempotencyKey(idem)
    }

    const payload = {
      rideId: form.rideId.trim(),
      amount: String(form.amount).trim(),
      currency: form.currency.trim().toUpperCase(),
      method: form.method,
    }

    if (payload.method === 'PAYOS' && !/^\d+$/.test(payload.amount)) {
      const message = 'PayOS requires integer amount in VND.'
      setError(message)
      toast?.push(message, 'danger')
      setLoading(false)
      return
    }

    if (form.userId.trim()) {
      payload.userId = form.userId.trim()
    }

    if (form.note.trim()) {
      payload.note = form.note.trim()
    }

    try {
      const result = await paymentService.create(
        payload,
        idem,
        authToken.trim()
      )
      setPayment(result.data)
      setVietqr(result.data?.vietqr || null)
      loadPayments()
      toast?.push('Đã tạo thanh toán', 'success')
    } catch (err) {
      const message = err?.message || 'Không thể tạo thanh toán'
      setError(message)
      toast?.push(message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  const handleFetchQr = async () => {
    if (!payment?.id) return
    if (!authToken.trim()) {
      const message = 'Chưa có token để gọi payment-service.'
      setError(message)
      toast?.push(message, 'danger')
      return
    }
    setLoadingQr(true)
    setError('')
    try {
      const result = await paymentService.getVietQr(
        payment.id,
        authToken.trim()
      )
      setVietqr(result?.vietqr || null)
      toast?.push('Đã tải VietQR', 'success')
    } catch (err) {
      const message = err?.message || 'Không thể tải VietQR'
      setError(message)
      toast?.push(message, 'danger')
    } finally {
      setLoadingQr(false)
    }
  }

  const handleConfirmDev = async () => {
    if (!payment?.id) return
    if (!authToken.trim()) {
      const message = 'Chưa có token để gọi payment-service.'
      setError(message)
      toast?.push(message, 'danger')
      return
    }
    setError('')
    try {
      const updated = await paymentService.confirmDev(
        payment.id,
        authToken.trim()
      )
      if (updated) {
        setPayment(updated)
      }
      loadPayments()
      toast?.push('Đã xác nhận thanh toán (dev)', 'success')
    } catch (err) {
      const message = err?.message || 'Không thể xác nhận thanh toán'
      setError(message)
      toast?.push(message, 'danger')
    }
  }

  const statusOptions = useMemo(
    () => ['INITIATED', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'],
    []
  )
  const isVietQrPayment = payment?.method === 'VIETQR'
  const isPayosPayment = payment?.method === 'PAYOS'
  const paymentAmountLabel = useMemo(
    () => formatMoney(payment?.amount, payment?.currency || 'VND'),
    [payment]
  )
  const statusText = payment?.status || 'INITIATED'
  const sheetHint = isPayosPayment
    ? 'Dung app ngan hang ho tro VietQR hoac app PayOS de quet.'
    : 'Quet ma de thanh toan nhanh.'

  const statusVariant = (status) => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'FAILED':
        return 'danger'
      case 'PROCESSING':
        return 'warning'
      case 'REFUNDED':
        return 'info'
      default:
        return 'info'
    }
  }

  const handleDraftChange = (id, field, value) => {
    setStatusDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleUpdateStatus = async (row) => {
    if (!authToken.trim()) {
      const message = 'Chưa có token để cập nhật thanh toán.'
      setListError(message)
      toast?.push(message, 'danger')
      return
    }
    const draft = statusDrafts[row.id] || {}
    const nextStatus = draft.status || row.status
    const failureReason = (draft.failureReason || '').trim()

    if (nextStatus === 'FAILED' && !failureReason) {
      const message = 'Cần nhập lý do khi chuyển sang FAILED.'
      setListError(message)
      toast?.push(message, 'danger')
      return
    }

    try {
      const updated = await paymentService.updateStatus(
        row.id,
        nextStatus,
        failureReason || null,
        authToken.trim()
      )
      if (updated) {
        setPayments((prev) =>
          prev.map((item) => (item.id === row.id ? updated : item))
        )
        setPayment((prev) => (prev?.id === row.id ? updated : prev))
      }
      toast?.push('Đã cập nhật trạng thái', 'success')
    } catch (err) {
      const message = err?.message || 'Không thể cập nhật trạng thái'
      setListError(message)
      toast?.push(message, 'danger')
    }
  }

  return (
    <div>
      <PageHeader
        title="Thanh toán QR"
        subtitle="Tạo giao dịch VietQR để kiểm tra nhanh luồng thanh toán."
      />

      <div className="grid grid-2">
        <form className="card" onSubmit={handleCreate}>
          <div className="card-header">
            <h3 className="card-title">Tạo thanh toán</h3>
          </div>
          <div className="grid grid-2">
            <Input
              label="Ride ID"
              name="rideId"
              value={form.rideId}
              onChange={handleChange}
              placeholder="ride_1"
              required
            />
            <Input
              label="User ID"
              name="userId"
              value={form.userId}
              onChange={handleChange}
              placeholder="user_1 (phải trùng token)"
            />
            <Input
              label="Số tiền"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              placeholder="120000"
              required
            />
            <Input
              label="Tiền tệ"
              name="currency"
              value={form.currency}
              onChange={handleChange}
              placeholder="VND"
              required
            />
            <Select
              label="Phương thức"
              name="method"
              value={form.method}
              onChange={handleChange}
            >
              <option value="VIETQR">VietQR (QR chuyển khoản)</option>
              <option value="PAYOS">PayOS (QR checkout)</option>
              <option value="CARD">Card</option>
            </Select>
            <Input
              label="Ghi chú"
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Thanh toán thử"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="input-label">Idempotency-Key</label>
            <div className="qr-inline">
              <input
                className="input"
                name="idempotencyKey"
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIdempotencyKey(buildIdemKey())}
              >
                Tạo key mới
              </Button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="input-label">Tự xác nhận (dev)</label>
            <div className="qr-inline">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(event) => setAutoConfirm(event.target.checked)}
              />
              <span className="text-muted">Tự chuyển PAID sau</span>
              <input
                className="input"
                type="number"
                min="1"
                value={autoConfirmDelay}
                onChange={(event) =>
                  setAutoConfirmDelay(event.target.value)
                }
                style={{ width: 90 }}
              />
              <span className="text-muted">giây</span>
            </div>
            <div className="input-helper">
              Dùng để test luồng trước khi tích hợp PayOS.
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="input-label">Bearer Token</label>
            <div className="qr-inline">
              <input
                className="input"
                name="authToken"
                value={authToken}
                onChange={(event) => setAuthToken(event.target.value)}
                placeholder="Dán JWT nếu backend yêu cầu xác thực"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthToken(sessionToken || '')}
                disabled={!sessionToken}
              >
                Dùng token đăng nhập
              </Button>
            </div>
            {!authToken.trim() && (
              <div className="input-helper">
                Chưa có token. Hãy đăng nhập admin hoặc dán JWT hợp lệ.
              </div>
            )}
            {authToken.trim() && !tokenSubject && (
              <div className="input-helper">
                Token không hợp lệ hoặc thiếu subject (sub).
              </div>
            )}
            {tokenSubject && (
              <div className="input-helper">
                Token subject: {tokenSubject}
              </div>
            )}
            {import.meta.env.VITE_MOCK === 'true' && (
              <div className="input-helper">
                Đang bật mock. Token mock không dùng được cho payment-service thật.
              </div>
            )}
          </div>
          {error && <div className="input-helper">{error}</div>}
          <div style={{ marginTop: 16 }}>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo thanh toán'}
            </Button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">QR & Thông tin</h3>
            <div className="qr-inline">
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchQr}
                disabled={!payment?.id || !isVietQrPayment || loadingQr}
              >
                {loadingQr ? 'Đang tải...' : isVietQrPayment ? 'Lấy VietQR' : 'QR PayOS tự sinh'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleConfirmDev}
                disabled={!payment?.id}
              >
                Xác nhận (dev)
              </Button>
            </div>
          </div>
          <div className="payment-sheet">
            <div className="payment-sheet-head">
              <div className="payment-sheet-brand-main">
                <VietQrLogo />
              </div>
              <div className="payment-sheet-brand-partners">
                <PayosLogo />
                <Badge variant={statusVariant(statusText)}>
                  {labelFrom(paymentStatusLabels, statusText)}
                </Badge>
              </div>
            </div>

            <div className="payment-sheet-qr">
              <div className="payment-sheet-qr-frame">
                <span className="payment-sheet-corner corner-tl" />
                <span className="payment-sheet-corner corner-tr" />
                <span className="payment-sheet-corner corner-bl" />
                <span className="payment-sheet-corner corner-br" />
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="Payment QR"
                    className="payment-sheet-qr-image"
                  />
                ) : (
                  <div className="payment-sheet-qr-empty">
                    QR will appear right after payment is created.
                  </div>
                )}
              </div>
            </div>

            <div className="payment-sheet-title">Scan To Pay</div>
            <div className="payment-sheet-caption">Quet ma thanh toan nhanh</div>
            <div className="payment-sheet-amount">{paymentAmountLabel}</div>
            <div className="payment-sheet-hint">{sheetHint}</div>

            <div className="payment-sheet-meta">
              <div>
                <span>Payment ID</span>
                <strong>{payment?.id || '-'}</strong>
              </div>
              <div>
                <span>Ride ID</span>
                <strong>{payment?.rideId || '-'}</strong>
              </div>
              <div>
                <span>PayOS orderCode</span>
                <strong>{payment?.payos?.orderCode || '-'}</strong>
              </div>
              <div>
                <span>PayOS paymentLinkId</span>
                <strong>{payment?.payos?.paymentLinkId || '-'}</strong>
              </div>
              <div>
                <span>VietQR reference</span>
                <strong>{vietqr?.reference || '-'}</strong>
              </div>
              <div>
                <span>Expires</span>
                <strong>{vietqr?.expiresAt || '-'}</strong>
              </div>
            </div>
          </div>
          {qrPayload && (
            <details className="payment-debug">
              <summary>Raw payload</summary>
              <div className="code-chip">{qrPayload}</div>
            </details>
          )}
          {isPayosPayment && payment?.payos?.checkoutUrl && (
            <div style={{ marginTop: 12 }}>
              <Button
                type="button"
                variant="primary"
                onClick={() =>
                  window.open(payment.payos.checkoutUrl, '_blank', 'noopener,noreferrer')
                }
              >
                Open PayOS Checkout
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Danh sách thanh toán</h3>
          <Button variant="outline" onClick={loadPayments} disabled={loadingList}>
            {loadingList ? 'Đang tải...' : 'Làm mới'}
          </Button>
        </div>
        {listError && <div className="input-helper">{listError}</div>}
        <Table
          columns={[
            {
              key: 'id',
              header: 'Mã',
              render: (row) => row.id?.slice(0, 8) || '-',
            },
            { key: 'rideId', header: 'Ride' },
            { key: 'userId', header: 'User' },
            {
              key: 'amount',
              header: 'Số tiền',
              render: (row) =>
                row.amount ? `${row.amount} ${row.currency}` : '-',
            },
            {
              key: 'method',
              header: 'Phương thức',
              render: (row) => row.method || '-',
            },
            {
              key: 'status',
              header: 'Trạng thái',
              render: (row) => (
                <Badge variant={statusVariant(row.status)}>
                  {labelFrom(paymentStatusLabels, row.status)}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: 'Cập nhật',
              render: (row) => {
                const draft = statusDrafts[row.id] || {}
                const nextStatus = draft.status || row.status
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      className="select"
                      value={nextStatus}
                      onChange={(event) =>
                        handleDraftChange(row.id, 'status', event.target.value)
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {labelFrom(paymentStatusLabels, status)}
                        </option>
                      ))}
                    </select>
                    {nextStatus === 'FAILED' && (
                      <input
                        className="input"
                        placeholder="Lý do"
                        value={draft.failureReason || ''}
                        onChange={(event) =>
                          handleDraftChange(
                            row.id,
                            'failureReason',
                            event.target.value
                          )
                        }
                        style={{ width: 160 }}
                      />
                    )}
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => handleUpdateStatus(row)}
                    >
                      Lưu
                    </Button>
                  </div>
                )
              },
            },
          ]}
          data={payments}
          total={payments.length}
          emptyText={loadingList ? 'Đang tải...' : 'Chưa có thanh toán'}
        />
      </div>
    </div>
  )
}

export default Payments
