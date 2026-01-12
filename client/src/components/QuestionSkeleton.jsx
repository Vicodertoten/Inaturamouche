import './QuestionSkeleton.css';

const QuestionSkeleton = () => (
  <div className="screen game-screen" aria-hidden="true">
    <div className="card question-skeleton">
      <div className="question-skeleton-header">
        <div className="skeleton-chip"></div>
        <div className="skeleton-chip"></div>
        <div className="skeleton-chip"></div>
      </div>
      <div className="question-skeleton-body">
        <div className="skeleton-media"></div>
        <div className="skeleton-choices">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
      </div>
    </div>
  </div>
);

export default QuestionSkeleton;
