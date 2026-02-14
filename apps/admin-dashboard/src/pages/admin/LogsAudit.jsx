import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader.jsx'
import LogTable from '../../components/admin/logs/LogTable.jsx'
import AuditTable from '../../components/admin/logs/AuditTable.jsx'
import LogDetailModal from '../../components/admin/logs/LogDetailModal.jsx'
import { auditService } from '../../services/audit.service.js'

function LogsAudit() {
  const [tab, setTab] = useState('logs')
  const [logs, setLogs] = useState([])
  const [audits, setAudits] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    async function load() {
      const [logResult, auditResult] = await Promise.all([
        auditService.listLogs(),
        auditService.listAudits(),
      ])
      setLogs(logResult.items)
      setAudits(auditResult.items)
    }

    load()
  }, [])

  return (
    <div>
      <PageHeader
        title="Nhật ký & Kiểm toán"
        subtitle="Nhật ký hoạt động và sự kiện bảo mật của hệ thống."
      />
      <div className="tabs">
        <div
          className={`tab ${tab === 'logs' ? 'active' : ''}`}
          onClick={() => setTab('logs')}
        >
          Nhật ký
        </div>
        <div
          className={`tab ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}
        >
          Kiểm toán
        </div>
      </div>
      <div className="card">
        {tab === 'logs' ? (
          <LogTable logs={logs} onSelect={setSelectedLog} />
        ) : (
          <AuditTable audits={audits} />
        )}
      </div>
      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}

export default LogsAudit
