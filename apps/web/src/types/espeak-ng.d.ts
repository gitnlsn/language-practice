declare module "espeak-ng" {
  const ESpeakNG: (moduleArg?: Record<string, unknown>) => Promise<any>;
  export default ESpeakNG;
}
