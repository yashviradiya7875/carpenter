import { Mark } from '../../../shared/components/Mark'
import { Button } from '../../../shared/ui'
import type { MaterialChoice } from '../dashboardTypes'

type MaterialPillProps = {
  label: string
  material: MaterialChoice
  onRemove: () => void
}

/** A chosen render material with a remove action. */
export function MaterialPill({ label, material, onRemove }: MaterialPillProps) {
  return (
    <div className="material-pill app-enter">
      {material.imageUrl ? <img src={material.imageUrl} alt="" /> : <span className="material-pill-placeholder"><Mark name="image" /></span>}
      <span><small>{label} material</small><strong>{material.name}</strong></span>
      <Button variant="ghost" size="xs" iconOnly icon="close" aria-label={`Remove ${label.toLowerCase()} material`} onClick={onRemove} />
    </div>
  )
}
