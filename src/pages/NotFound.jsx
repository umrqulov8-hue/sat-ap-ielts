import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-inner">
        <span className="not-found-code">404</span>
        <h1 className="not-found-title">PAGE NOT FOUND</h1>
        <p className="not-found-desc">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="not-found-btn">GO HOME</Link>
      </div>
    </div>
  )
}
