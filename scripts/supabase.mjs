// Ejecuta la CLI de Supabase con las variables de .env, sin escribir claves en la terminal.
//   npm run db:push           aplica las migraciones pendientes (supabase/migrations)
//   npm run functions:deploy  publica las Edge Functions (sin Docker)
//   npm run db:types          regenera los tipos de TypeScript de la base de datos
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cli = join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const { EXPO_PUBLIC_SUPABASE_URL: url, SUPABASE_DB_URL: dbUrl, SUPABASE_ACCESS_TOKEN: token } = process.env;

if (!url || !dbUrl || !token) {
  console.error('Faltan variables en .env (ver .env.example).');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];

const tasks = {
  'db:push': { args: ['db', 'push', '--db-url', dbUrl] },
  'functions:deploy': { args: ['functions', 'deploy', '--project-ref', ref, '--use-api'] },
  types: {
    args: ['gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public'],
    output: join(root, 'src', 'services', 'account', 'database.types.ts'),
  },
};

const task = tasks[process.argv[2]];
if (!task) {
  console.error(`Tarea desconocida. Opciones: ${Object.keys(tasks).join(', ')}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [cli, ...task.args, ...process.argv.slice(3)], {
  cwd: root,
  stdio: task.output ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  encoding: 'utf8',
});
if (result.status === 0 && task.output) {
  writeFileSync(task.output, `// Generado con \`npm run db:types\`. No editar a mano.\n${result.stdout}`);
  console.log(`Tipos escritos en ${task.output}`);
}
process.exit(result.status ?? 1);
