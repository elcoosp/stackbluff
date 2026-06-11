/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_TELEGRAM: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
