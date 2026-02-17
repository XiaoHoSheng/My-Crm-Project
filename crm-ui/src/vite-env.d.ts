/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string; // ✅ 你的后端地址
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}



// / <reference types="vite/client" />