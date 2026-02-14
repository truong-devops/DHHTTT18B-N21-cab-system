import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'

import PageHeader from '../../components/common/PageHeader.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Select from '../../components/common/Select.jsx'

import { paymentService } from '../../services/payment.service.js'
import { useToast } from '../../hooks/useToast.js'
import { useAuth } from '../../hooks/useAuth.js'

const DEFAULT_FORM = {
  rideId: 'ride_demo_001',
  userId: '',
  amount: '120000',
  currency: 'VND',
  method: 'VIETQR',
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
  const [payment, setPayment] = useState(null)
  const [vietqr, setVietqr] = useState(null)
  const [qrFallback, setQrFallback] = useState('')
  const [error, setError] = useState('')
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

  const qrImage = useMemo(() => {
    if (vietqr?.qrUrl && String(vietqr.qrUrl).startsWith('data:image')) {
      return vietqr.qrUrl
    }
    if (
      payment?.payos?.qrCode &&
      String(payment.payos.qrCode).startsWith('data:image')
    ) {
      return payment.payos.qrCode
    }
    return qrFallback
  }, [payment, vietqr])

  const qrPayload = useMemo(() => {
    if (vietqr?.payload) return vietqr.payload
    if (payment?.payos?.qrCode && !qrImage) return payment.payos.qrCode
    return ''
  }, [payment, qrImage, vietqr])

  useEffect(() => {
    let mounted = true

    async function generateQr() {
      if (!qrPayload || qrImage) {
        if (mounted) setQrFallback('')
        return
      }
      try {
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
  }, [qrPayload, qrImage])

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
      toast?.push('Đã xác nhận thanh toán (dev)', 'success')
    } catch (err) {
      const message = err?.message || 'Không thể xác nhận thanh toán'
      setError(message)
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
                disabled={!payment?.id || loadingQr}
              >
                {loadingQr ? 'Đang tải...' : 'Lấy VietQR'}
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
          <div className="qr-preview">
            {qrImage ? (
              <img src={qrImage} alt="VietQR" className="qr-image" />
            ) : (
              <div className="text-muted">
                Chưa có QR. Tạo thanh toán VietQR để hiển thị mã QR.
              </div>
            )}
          </div>
          <div className="qr-meta">
            <div>
              <span>Mã thanh toán:</span>{' '}
              <strong>{payment?.id || '-'}</strong>
            </div>
            <div>
              <span>Trạng thái:</span>{' '}
              <strong>{payment?.status || '-'}</strong>
            </div>
            <div>
              <span>Số tiền:</span>{' '}
              <strong>
                {payment?.amount ? `${payment.amount} ${payment.currency}` : '-'}
              </strong>
            </div>
            <div>
              <span>Tham chiếu VietQR:</span>{' '}
              <strong>{vietqr?.reference || '-'}</strong>
            </div>
            <div>
              <span>Hết hạn:</span>{' '}
              <strong>{vietqr?.expiresAt || '-'}</strong>
            </div>
          </div>
          {qrPayload && (
            <div style={{ marginTop: 12 }}>
              <div className="input-label">Payload</div>
              <div className="code-chip">{qrPayload}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Payments
