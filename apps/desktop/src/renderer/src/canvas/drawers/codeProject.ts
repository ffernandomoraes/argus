import { baseName, isAbsolutePath, untildify } from '../../platform'
import type { ProjectData } from '../types'
import { fileInFolder, ownFolder } from './fileInFolder'

// Pasta cujo código abre para um arquivo da conversa. No workspace, a pasta dele onde o arquivo
// está (a do workspace em si só tem o aviso para os agentes). Fora da pasta da conversa (a
// temporária do Claude, a da memória), a pasta do próprio arquivo. Caminho relativo, a da conversa.
export function codeProject(project: ProjectData, path: string): ProjectData {
  if (!isAbsolutePath(untildify(path))) return project
  const inside = (folder: string) => fileInFolder(folder, path) !== null
  if (!project.folders && inside(project.path)) return project
  const folder = project.folders?.find(inside) ?? ownFolder(path)?.root
  return folder ? { name: baseName(folder), path: folder, color: project.color } : project
}
