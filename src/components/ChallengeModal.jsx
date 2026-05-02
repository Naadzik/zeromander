import '../styles/ChallengeModal.css'

export default function ChallengeModal({ challenge, isOpen, onClose, onSelect }) {
  if (!isOpen || !challenge) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content challenge-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>{challenge.icon}</span>
            <div>
              <h2 style={{ margin: 0 }}>{challenge.name}</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#6B7280' }}>{challenge.description}</p>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6B7280'
            }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="rules-section">
            <h3>Challenge Rules</h3>
            <p>{challenge.rules}</p>
          </div>

          <div className="goal-section">
            <h3>Objective</h3>
            <div className="goal-box">
              <p>{challenge.goalDescription}</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => {
            onSelect(challenge.id);
            onClose();
          }}>
            Start Challenge
          </button>
        </div>
      </div>
    </div>
  );
}
