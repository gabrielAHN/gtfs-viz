

const originalConsoleError = console.error.bind(console);

(console as any).error = (...args: any[]) => {
  const shouldSuppress = args.some(arg => {
    const str = typeof arg === 'string'
      ? arg
      : arg instanceof Error
        ? `${arg.message} ${arg.stack}`
        : String(arg);

    return (
      str.includes('onager.duckdb_extension.wasm') ||
      str.includes('Missing DB manager') ||
      str.includes('Extension https://')
    );
  });

  if (!shouldSuppress) {
    originalConsoleError(...args);
  }
};

export {};
