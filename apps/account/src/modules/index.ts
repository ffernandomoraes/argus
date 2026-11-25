import { claudeModule } from './claude/claude.module';
import { desktopModule } from './desktop/desktop.module';
import { githubModule } from './github/github.module';
import { noticesModule } from './notices/notices.module';
import { profileModule } from './profile/profile.module';
import { remoteModule } from './remote/remote.module';
import { syncModule } from './sync/sync.module';
import { systemModule } from './system/system.module';
import type { ApiModule } from './types';
import { workspacesModule } from './workspaces/workspaces.module';

// Os módulos montados em /api, na ordem (ver app.ts).
export const apiModules: ApiModule[] = [systemModule, desktopModule, profileModule, syncModule, workspacesModule, claudeModule, remoteModule, noticesModule, githubModule];
