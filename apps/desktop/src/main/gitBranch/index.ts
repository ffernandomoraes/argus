// Git das pastas do canvas: branch (e a troca dela), remoto, arquivos não comitados e o diff de um arquivo.
export { currentBranch, gitDir } from './repo'
export { repoUrl } from './remote'
export { forgetStatus, uncommittedFiles } from './status'
export { fileDiff } from './diff'
export { checkoutBranch, fetchBranches, listBranches } from './switch'
