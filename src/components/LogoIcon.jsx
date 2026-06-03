import { Link } from 'react-router-dom'

export default function LogoIcon({ size = 40, className = '' }) {
  return (
    <Link to="/dashboard" className={`logo-fixed ${className}`} style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.45 }}>S</span>
    </Link>
  )
}
