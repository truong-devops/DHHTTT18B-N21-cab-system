import Button from '../../common/Button.jsx';

import Input from '../../common/Input.jsx';

function PricingSimulator({ result, onSimulate }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Mô phỏng giá cước</h3>
      </div>
      <div className="grid grid-2">
        <Input label="Điểm đón" placeholder="Vĩ độ, Kinh độ" />
        <Input label="Điểm đến" placeholder="Vĩ độ, Kinh độ" />
      </div>
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" onClick={onSimulate}>
          Mô phỏng
        </Button>
      </div>
      {result && (
        <div style={{ marginTop: 12 }}>
          <strong>Hệ số:</strong> {result.multiplier} | <strong>Cước phí ước tính:</strong> {result.estimatedFare}
        </div>
      )}
    </div>
  );
}

export default PricingSimulator;
