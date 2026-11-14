import { Link } from 'react-router-dom'
import OrbiImage from '../components/orbi/OrbiImage'

export default function NotFound() {
  return (
    <div className="ob-404">
      <div>
        <OrbiImage pose="think" size={640} eager alt="Orbi oʻylanib turibdi" />
        <h1>Bu sahifa topilmadi</h1>
        <p>Qidirayotgan sahifangiz mavjud emas yoki koʻchirilgan.</p>
        <Link to="/" className="ob-btn big">BOSH SAHIFAGA</Link>
      </div>
    </div>
  )
}
