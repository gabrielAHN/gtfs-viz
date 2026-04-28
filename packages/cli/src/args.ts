export type Args = {
  command?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export const parseArgs = (argv: string[]): Args => {
  const command = argv[0]?.startsWith("-") ? undefined : argv[0];
  const rest = command ? argv.slice(1) : argv;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const value = rest[i];
    if (value === "-h") {
      flags.help = true;
      continue;
    }

    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const raw = value.slice(2);
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }

    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags[raw] = next;
      i += 1;
    } else {
      flags[raw] = true;
    }
  }

  return { command, positionals, flags };
};

export const getFlagString = (
  flags: Record<string, string | boolean>,
  name: string,
  fallback?: string,
) => {
  const value = flags[name];
  if (typeof value === "string") return value;
  return fallback;
};

export const hasFlag = (flags: Record<string, string | boolean>, name: string) =>
  flags[name] === true;

export const wantsDataOutput = (flags: Record<string, string | boolean>) =>
  hasFlag(flags, "data") || typeof flags.format === "string";
