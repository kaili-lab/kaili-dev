import handler from '@tanstack/react-start/server-entry'

import { runMediaCleanup, type MediaRuntimeEnv } from '#/features/media.server'

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: MediaRuntimeEnv): Promise<void> {
    await runMediaCleanup(env)
  },
}
