/// <reference types="vite/client" />

// Vite `?inline` asset imports resolve to a data: URL string.
declare module "*.jpg?inline" {
  const src: string;
  export default src;
}
