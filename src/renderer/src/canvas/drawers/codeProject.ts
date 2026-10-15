import { baseName, isAbsolutePath, untildify } from '../../platform'
import type { ProjectData } from '../types'
import { fileInFolder } from './fileInFolder'

// Pasta cujo código abre para um arquivo da conversa. No workspace, a pasta dele onde o arquivo
// está (a do workspace em si só tem o aviso para os agentes); caminho relativo ou fora de todas,
// o próprio workspace.
export function codeProject(project: ProjectData, path: string): ProjectData {
  if (!project.folders || !isAbsolutePath(untildify(path))) return project
  const folder = project.folders.find((f) => fileInFolder(f, path) !== null)
  return folder ? { name: baseName(folder), path: folder, color: project.color } : project
}
