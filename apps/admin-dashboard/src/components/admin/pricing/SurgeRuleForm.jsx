import Button from '../../common/Button.jsx';

import Input from '../../common/Input.jsx';

import Select from '../../common/Select.jsx';

function SurgeRuleForm({ onSubmit }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Tạo quy tắc tăng giá</h3>
      </div>
      <div className="grid grid-2">
        <Input label="Tên quy tắc" placeholder="Cao điểm sân bay" />
        <Input label="Khu vực" placeholder="Sân bay" />
        <Input label="Hệ số" placeholder="1.5" />
        <Select label="Trạng thái">
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="INACTIVE">Ngừng áp dụng</option>
        </Select>
      </div>
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" onClick={onSubmit}>
          Lưu quy tắc
        </Button>
      </div>
    </div>
  );
}

export default SurgeRuleForm;
