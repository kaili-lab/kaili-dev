declare module 'cloudflare:workers' {
  type R2ObjectBody = {
    body: ReadableStream<Uint8Array>
    httpEtag?: string
  }
  type R2Bucket = {
    put(
      key: string,
      value: ReadableStream<Uint8Array>,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>
    get(key: string): Promise<R2ObjectBody | null>
    delete(key: string): Promise<void>
  }
  export const env: {
    ASSETS: { fetch(request: Request): Promise<Response> }
    DB: import('#/server/data/db').D1Database
    MEDIA: R2Bucket
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
    GITHUB_ALLOWED_USER_ID?: string
    SESSION_SECRET?: string
  }
}

// Cloudflare's Vite plugin compiles `.wasm?module` imports ahead of time.
declare module '*.wasm?module' {
  const module: WebAssembly.Module
  export default module
}
