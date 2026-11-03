/**
 * Metro asset registry module declarations.
 * `require('./x.png')` resolves to a numeric asset registry id at runtime.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}
