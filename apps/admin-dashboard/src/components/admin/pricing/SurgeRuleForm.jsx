import Button from '../../common/Button.jsx'
import Input from '../../common/Input.jsx'
import Select from '../../common/Select.jsx'

function SurgeRuleForm({ onSubmit }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Create Surge Rule</h3>
      </div>
      <div className="grid grid-2">
        <Input label="Rule name" placeholder="Airport Peak" />
        <Input label="Zone" placeholder="Airport" />
        <Input label="Multiplier" placeholder="1.5" />
        <Select label="Status">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </Select>
      </div>
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" onClick={onSubmit}>
          Save Rule
        </Button>
      </div>
    </div>
  )
}

export default SurgeRuleForm
