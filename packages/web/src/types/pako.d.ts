declare module "pako" {
  const pako: {
    inflateRaw(data: Uint8Array): Uint8Array
  }

  export default pako
}
