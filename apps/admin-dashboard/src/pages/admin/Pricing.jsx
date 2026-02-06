import { useEffect, useState } from 'react'
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
      const result = await pricingService.listRules()
      setRules(result.items)
    }

    load()
  }, [])

  const handleToggle = async (rule) => {
    const enabled = rule.status !== 'ACTIVE'
    await pricingService.toggleRule(rule.id, enabled)
    toast?.push('Rule updated', 'success')
  }

  const handleSimulate = async () => {
    const result = await pricingService.simulate({})
    setSimResult(result)
  }

  return (
    <div>
      <h1 className="page-title">Pricing</h1>
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
