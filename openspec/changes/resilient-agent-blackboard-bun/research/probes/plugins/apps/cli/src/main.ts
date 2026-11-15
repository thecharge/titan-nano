import { loadPlugins } from "@titan/core"; console.log(JSON.stringify(await loadPlugins(process.argv.slice(2), process.cwd()), null, 1));
