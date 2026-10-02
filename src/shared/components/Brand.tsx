import { Mark } from './Mark'
import './Brand.css'

/** Carpenter Pro wordmark for app bars. */
export function Brand() {
  return (
    <span className="product-brand">
      <span className="product-brand-mark"><Mark name="layers" /></span>
      <span>carpenter<span className="product-brand-light">.pro</span></span>
    </span>
  )
}
