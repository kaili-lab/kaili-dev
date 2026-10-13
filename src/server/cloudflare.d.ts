declare module 'cloudflare:workers' {
  export const env: {
    ASSETS: { fetch(request: Request): Promise<Response> }
  }
}

// Cloudflare's Vite plugin compiles `.wasm?module` imports ahead of time.
declare module '*.wasm?module' {
  const module: WebAssembly.Module
  export default module
}
