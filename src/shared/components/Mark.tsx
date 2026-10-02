import { Icon, type IconName } from '../ui'
import './Mark.css'

/** Carpenter Pro's icon: the design-system Icon with the app's sizing hook (`.mark-icon`). */
export function Mark({ name }: { name: IconName }) {
  return <Icon name={name} className="mark-icon" />
}
