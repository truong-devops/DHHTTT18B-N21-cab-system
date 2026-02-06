import Button from './Button.jsx'

function Drawer({ title, children, onClose }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Drawer
