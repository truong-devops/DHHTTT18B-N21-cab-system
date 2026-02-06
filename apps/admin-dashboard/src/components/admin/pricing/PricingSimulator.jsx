import Button from '../../common/Button.jsx'
import Input from '../../common/Input.jsx'

function PricingSimulator({ result, onSimulate }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Pricing Simulator</h3>
      </div>
      <div className="grid grid-2">
        <Input label="Pickup" placeholder="Lat, Lng" />
        <Input label="Dropoff" placeholder="Lat, Lng" />
      </div>
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" onClick={onSimulate}>
          Simulate
        </Button>
      </div>
      {result && (
        <div style={{ marginTop: 12 }}>
          <strong>Multiplier:</strong> {result.multiplier} |{' '}
          <strong>Estimated Fare:</strong> {result.estimatedFare}
        </div>
      )}
    </div>
  )
}

export default PricingSimulator
