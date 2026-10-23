// Funções puras sobre a lista de nós do canvas, sem React nem Electron. Cada arquivo cuida de
// um assunto; quem usa importa daqui (./operations).
export { addNode, placeBelow, placeBeside } from './add'
export { organizeBoard, organizeGroup } from './arrange'
export {
  groupAccount,
  removeNode,
  rename,
  setGroupAccount,
  setGroupColor,
  setWorkspaceFolders,
  setNoteColor,
  setNoteText,
  setNoteWidth
} from './edits'
export { findChatSpot } from './freeSpace'
export { boundsOf, COLLAPSED_SIZE, FIT_PADDING, isPlaced, sizeOf, type Box } from './geometry'
export { groupFolders, groupWideOf, isGroupWide, setGroupWideFolders } from './groupWide'
export { dropIntoGroup, groupUnder, leaveGroup, moveToGroup, removeGroup, terminalsIn, ungroup } from './groups'
export { fitAfterResize, fitGroupToContent, growGroupsToFit, withoutAutoGrow } from './groupSize'
export { pushAway } from './push'
export { absolutePosition, childrenOf } from './tree'
export { toggleCollapse, toggleObscure, toggleProjectCollapse } from './visibility'
export { addWorktreeCard, followParents, hiddenWorktrees, worktreesOf } from './worktrees'
