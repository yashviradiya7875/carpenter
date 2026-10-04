import { Mark } from '../../../shared/components/Mark'
import type { DriveFolder } from '../filesService'

type DriveFolderTreeProps = {
  folders: DriveFolder[]
  currentFolderId: string | null
  activePath: string[]
  expandedFolderIds: Set<string>
  isLoading: boolean
  onNavigate: (folderId: string) => void
  onToggle: (folderId: string) => void
}

/** The folders of My Files as a tree, shown in the sidebar under its sections. */
export function DriveFolderTree({ folders, currentFolderId, activePath, expandedFolderIds, isLoading, onNavigate, onToggle }: DriveFolderTreeProps) {
  const rootFolders = folders.filter((folder) => folder.parentId === null)
  return (
    <nav className="files-folder-tree-panel" aria-label="Folders">
      <div className="files-tree-heading">Folders</div>
      {isLoading ? <div className="files-tree-state" role="status">Loading folders…</div> : rootFolders.length ? (
        <ul className="files-tree">
          {rootFolders.map((folder) => (
            <DriveFolderTreeBranch
              key={folder.id}
              folder={folder}
              folders={folders}
              currentFolderId={currentFolderId}
              activePath={activePath}
              expandedFolderIds={expandedFolderIds}
              depth={0}
              onNavigate={onNavigate}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : <p className="files-tree-state">No folders yet</p>}
    </nav>
  )
}

type DriveFolderTreeBranchProps = Omit<DriveFolderTreeProps, 'isLoading'> & {
  folder: DriveFolder
  depth: number
}

function DriveFolderTreeBranch({ folder, folders, currentFolderId, activePath, expandedFolderIds, depth, onNavigate, onToggle }: DriveFolderTreeBranchProps) {
  const children = folders.filter((candidate) => candidate.parentId === folder.id)
  const isExpanded = expandedFolderIds.has(folder.id)
  const isCurrent = currentFolderId === folder.id

  return (
    <li className="files-tree-branch">
      <div className={`files-tree-row ${isCurrent ? 'is-current' : ''} ${activePath.includes(folder.id) ? 'is-in-path' : ''}`} style={{ paddingLeft: `${2 + depth * 14}px` }}>
        {children.length ? (
          <button className={`files-tree-toggle ${isExpanded ? 'is-expanded' : ''}`} type="button" aria-label={`${folder.name} subfolders`} aria-expanded={isExpanded} onClick={() => onToggle(folder.id)}>
            <Mark name="arrow" />
          </button>
        ) : <span className="files-tree-toggle-placeholder" />}
        <button className="files-tree-folder" type="button" onClick={() => onNavigate(folder.id)} title={folder.name} aria-current={isCurrent ? 'page' : undefined}>
          <Mark name="folder" /><span>{folder.name}</span>
        </button>
      </div>
      {isExpanded && children.length ? (
        <ul className="app-enter">
          {children.map((child) => (
            <DriveFolderTreeBranch
              key={child.id}
              folder={child}
              folders={folders}
              currentFolderId={currentFolderId}
              activePath={activePath}
              expandedFolderIds={expandedFolderIds}
              depth={depth + 1}
              onNavigate={onNavigate}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
