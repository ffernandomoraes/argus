import { ACCENT, ACCENT_SOFT, Arrowhead, Art, Badge, Bar, FILL, LINE, Laptop, SURFACE, Trail } from './parts';

// Ilustrações das telas vazias, uma por contexto, todas no mesmo traço: contorno neutro, o que
// importa no destaque e um tracejado mostrando o que vai acontecer ali.

// Workspaces: um workspace indo de um computador para o outro.
export function WorkspacesArt() {
  return (
    <Art>
      <Laptop x={10} active />
      <Laptop x={218} />
      <Trail d="M112 44 C 140 6, 180 6, 208 44" />
      <Arrowhead d="M201 38 l7 6 l-9 2" />
      <Badge x={146} y={2}>
        <rect x="8" y="8" width="5" height="5" rx="1" fill={ACCENT} />
        <rect x="15" y="8" width="5" height="5" rx="1" fill={ACCENT} />
        <rect x="8" y="15" width="5" height="5" rx="1" fill={ACCENT} />
        <rect x="15" y="15" width="5" height="5" rx="1" fill={ACCENT} opacity="0.5" />
      </Badge>
    </Art>
  );
}

// Servidores: o terminal com o play, e a página que vai abrir na porta, ainda tracejada.
export function ServersArt() {
  return (
    <Art>
      <rect x="24" y="14" width="140" height="82" rx="8" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
      <circle cx="36" cy="26" r="2.5" fill={LINE} />
      <circle cx="45" cy="26" r="2.5" fill={LINE} />
      <circle cx="54" cy="26" r="2.5" fill={LINE} />
      <path d="M24 36 H164" stroke={LINE} strokeWidth="1.5" />
      <Bar x={36} y={47} w={6} fill={ACCENT} />
      <Bar x={46} y={47} w={60} />
      <Bar x={36} y={60} w={92} opacity={0.6} />
      <Bar x={36} y={73} w={44} opacity={0.6} />
      <rect x="84" y="70" width="6" height="10" rx="1" fill={ACCENT} />
      <Trail d="M168 55 H182" />
      <Badge x={186} y={41}>
        <path d="M11 9 L19 14 L11 19 Z" fill={ACCENT} strokeLinejoin="round" />
      </Badge>
      <Trail d="M218 55 H230" />
      <Arrowhead d="M226 51 l4 4 l-4 4" />
      <rect x="236" y="24" width="70" height="62" rx="7" fill={SURFACE} stroke={LINE} strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="243" y="31" width="56" height="9" rx="4.5" fill={FILL} />
      <Bar x={246} y={50} w={40} opacity={0.5} />
      <Bar x={246} y={61} w={28} opacity={0.5} />
      <Bar x={246} y={72} w={34} opacity={0.5} />
    </Art>
  );
}

// Tarefas em segundo plano: a fila de tarefas parada e o relógio esperando a próxima.
export function TasksArt() {
  const rows = [
    { y: 12, opacity: 1 },
    { y: 43, opacity: 0.7 },
    { y: 74, opacity: 0.45 },
  ];
  return (
    <Art>
      {rows.map(({ y, opacity }) => (
        <g key={y} opacity={opacity}>
          <rect x="50" y={y} width="180" height="24" rx="7" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
          <circle cx="64" cy={y + 12} r="5" fill="none" stroke={LINE} strokeWidth="1.5" />
          <Bar x={78} y={y + 10} w={92} />
          <Bar x={180} y={y + 10} w={36} opacity={0.6} />
        </g>
      ))}
      <Trail d="M234 24 C 252 24, 262 30, 262 38" />
      <Badge x={248} y={41}>
        <circle cx="14" cy="14" r="7" fill="none" stroke={ACCENT} strokeWidth="1.5" />
        <path d="M14 10 V14 L17 16" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Badge>
    </Art>
  );
}

// Agentes: o robô especialista, chamado por @nome, com as instruções dele ao lado.
export function AgentsArt() {
  return (
    <Art>
      <rect x="34" y="22" width="72" height="26" rx="13" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
      <text x="46" y="40" fontSize="15" fontWeight="600" fill={ACCENT}>
        @
      </text>
      <Bar x={64} y={33} w={30} />
      <Trail d="M106 40 C 114 42, 118 46, 120 50" />
      <path d="M160 30 V19" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="160" cy="16" r="3.5" fill={ACCENT} />
      <rect x="121" y="46" width="7" height="16" rx="3" fill={LINE} />
      <rect x="192" y="46" width="7" height="16" rx="3" fill={LINE} />
      <rect x="128" y="30" width="64" height="50" rx="14" fill={SURFACE} stroke={ACCENT} strokeWidth="1.5" />
      <circle cx="147" cy="52" r="4.5" fill={ACCENT} />
      <circle cx="173" cy="52" r="4.5" fill={ACCENT} />
      <rect x="150" y="64" width="20" height="4" rx="2" fill={ACCENT_SOFT} />
      <Trail d="M200 66 C 204 70, 208 72, 214 72" />
      <rect x="214" y="60" width="72" height="26" rx="7" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
      <Bar x={224} y={67} w={50} />
      <Bar x={224} y={76} w={32} opacity={0.6} />
      <path d="M232 14 L234 20 L240 22 L234 24 L232 30 L230 24 L224 22 L230 20 Z" fill={ACCENT} />
      <path d="M252 34 L253 37 L256 38 L253 39 L252 42 L251 39 L248 38 L251 37 Z" fill={ACCENT} opacity="0.6" />
    </Art>
  );
}

// Acesso remoto: o computador daqui e o celular, ligados pela internet.
export function RemoteDevicesArt() {
  return (
    <Art>
      <Laptop x={16} active />
      <rect x="250" y="12" width="48" height="86" rx="9" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
      <rect x="255" y="20" width="38" height="66" rx="4" fill={FILL} />
      <rect x="260" y="27" width="28" height="12" rx="2.5" fill={LINE} opacity="0.6" />
      <rect x="260" y="44" width="28" height="12" rx="2.5" fill={LINE} opacity="0.6" />
      <rect x="260" y="61" width="18" height="12" rx="2.5" fill={LINE} opacity="0.6" />
      <Bar x={266} y={90} w={16} h={3} />
      <Trail d="M118 44 C 150 8, 210 8, 244 44" />
      <Arrowhead d="M237 38 l7 6 l-9 2" />
      <Badge x={167} y={2}>
        <path d="M7.5 12.5 Q14 6 20.5 12.5" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.5 15.5 Q14 12 17.5 15.5" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="19.5" r="1.8" fill={ACCENT} />
      </Badge>
    </Art>
  );
}

// GitHub: a conta ligada aos repositórios que o Argus pode clonar.
export function GitHubArt() {
  return (
    <Art>
      <Trail d="M98 50 C 140 50, 150 24, 192 24" />
      <Trail d="M98 55 H192" />
      <Trail d="M98 60 C 140 60, 150 86, 192 86" />
      <circle cx="70" cy="55" r="27" fill={SURFACE} stroke={ACCENT} strokeWidth="1.5" />
      <circle cx="70" cy="48" r="8" fill={ACCENT_SOFT} />
      <path d="M55 72 a15 12 0 0 1 30 0 z" fill={ACCENT_SOFT} />
      {[12, 43, 74].map((y, i) => (
        <g key={y} opacity={1 - i * 0.2}>
          <rect x="196" y={y} width="100" height="24" rx="7" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
          <path d={`M206 ${y + 8} h5 l2 2 h7 v7 h-14 z`} fill={LINE} />
          <Bar x={228} y={y + 10} w={54} />
        </g>
      ))}
    </Art>
  );
}

// Nenhum agente conectado: a tomada esperando o plugue.
export function ConnectAgentArt() {
  return (
    <Art>
      <path d="M16 80 C 60 80, 70 55, 110 55" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      <rect x="110" y="42" width="34" height="26" rx="6" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
      <rect x="144" y="47" width="12" height="5" rx="1.5" fill={LINE} />
      <rect x="144" y="58" width="12" height="5" rx="1.5" fill={LINE} />
      <Arrowhead d="M164 40 l6 6" />
      <Arrowhead d="M163 55 h9" />
      <Arrowhead d="M164 70 l6 -6" />
      <rect x="182" y="28" width="56" height="54" rx="12" fill={SURFACE} stroke={ACCENT} strokeWidth="1.5" />
      <rect x="190" y="46" width="12" height="7" rx="2" fill={ACCENT_SOFT} />
      <rect x="190" y="57" width="12" height="7" rx="2" fill={ACCENT_SOFT} />
      <path d="M222 44 L224 51 L231 53 L224 55 L222 62 L220 55 L213 53 L220 51 Z" fill={ACCENT} />
      <path d="M238 55 C 270 55, 278 80, 306 80" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}

// MCP: o agente no meio, ligado às ferramentas de fora.
export function McpArt() {
  const boxes = [
    { x: 30, y: 14 },
    { x: 30, y: 66 },
    { x: 220, y: 14 },
    { x: 220, y: 66 },
  ];
  return (
    <Art>
      <Trail d="M102 29 C 120 29, 122 48, 138 48" />
      <Trail d="M102 81 C 120 81, 122 62, 138 62" />
      <Trail d="M218 29 C 200 29, 198 48, 182 48" />
      <Trail d="M218 81 C 200 81, 198 62, 182 62" />
      {boxes.map(({ x, y }, i) => (
        <g key={`${x}-${y}`} opacity={i % 2 ? 0.65 : 1}>
          <rect x={x} y={y} width="70" height="30" rx="7" fill={SURFACE} stroke={LINE} strokeWidth="1.5" />
          <circle cx={x + 13} cy={y + 15} r="3.5" fill={LINE} />
          <Bar x={x + 23} y={y + 9} w={36} />
          <Bar x={x + 23} y={y + 17} w={24} opacity={0.6} />
        </g>
      ))}
      <Badge x={140} y={35} size={40}>
        <path d="M15 9 V15 M25 9 V15" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 15 H29 V20 a9 9 0 0 1 -18 0 Z" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M20 29 V33" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      </Badge>
    </Art>
  );
}

// Instruções e skills de um agente, ainda sem nada: o arquivo de instruções com a skill, e a conta
// (a nuvem) tracejada, esperando.
export function AgentFilesArt() {
  return (
    <Art>
      <path d="M70 14 h46 l14 14 v68 h-60 z" fill={SURFACE} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M116 14 v14 h14" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <Bar x={80} y={36} w={34} />
      <Bar x={80} y={46} w={40} opacity={0.6} />
      <Bar x={80} y={56} w={28} opacity={0.6} />
      <Badge x={112} y={64}>
        <path d="M14 6 L16 12 L22 14 L16 16 L14 22 L12 16 L6 14 L12 12 Z" fill={ACCENT} />
      </Badge>
      <Trail d="M150 56 C 170 40, 184 40, 200 50" />
      <Arrowhead d="M193 46 l7 4 l-8 3" />
      <path
        d="M214 82 h58 a17 17 0 0 0 2 -34 a24 24 0 0 0 -45 -8 a18 18 0 0 0 -15 42 z"
        fill={FILL}
        stroke={LINE}
        strokeWidth="1.5"
        strokeDasharray="4 5"
        strokeLinejoin="round"
      />
    </Art>
  );
}
