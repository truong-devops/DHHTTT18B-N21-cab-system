import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader.jsx'
import SurgeRuleForm from '../../components/admin/pricing/SurgeRuleForm.jsx'
import SurgeRuleTable from '../../components/admin/pricing/SurgeRuleTable.jsx'
import PricingSimulator from '../../components/admin/pricing/PricingSimulator.jsx'
import { pricingService } from '../../services/pricing.service.js'
import { useToast } from '../../hooks/useToast.js'

function Pricing() {
  const toast = useToast()
  const [rules, setRules] = useState([])
  const [simResult, setSimResult] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await pricingService.listRules()
        setRules(result.items)
      } catch (error) {
        toast?.push(error.message || 'Failed to load rules', 'danger')
      }
    }

    load()
  }, [])

  const handleToggle = async (rule) => {
    const enabled = rule.status !== 'ACTIVE'
    try {
      const updated = await pricingService.toggleRule(rule.id, enabled)
      setRules((prev) =>
        prev.map((item) =>
          item.id === rule.id ? { ...item, ...(updated || {}) } : item
        )
      )
      toast?.push('Rule updated', 'success')
    } catch (error) {
      toast?.push(error.message || 'Failed to update rule', 'danger')
    }
  }

  const handleSimulate = async () => {
    const result = await pricingService.simulate({})
    setSimResult(result)
  }

  return (
    <div>
      <PageHeader
        title="Pricing"
        subtitle="Manage surge strategy and simulate fares before release."
      />
      <div className="grid grid-2">
        <SurgeRuleForm onSubmit={() => toast?.push('Rule saved', 'success')} />
        <PricingSimulator result={simResult} onSimulate={handleSimulate} />
      </div>
      <div className="card">
        <SurgeRuleTable rules={rules} onToggle={handleToggle} />
      </div>
    </div>
  )
}

export default Pricing
