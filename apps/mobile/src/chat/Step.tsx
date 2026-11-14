import type { ReactNode } from 'react';

// Um passo da conversa, como na linha do tempo do Argus: bolinha à esquerda, na altura da primeira
// linha, e um fio até a bolinha do passo seguinte (connect). As cores: verde terminou, vermelho deu
// erro, laranja pulsando está rodando, cinza é resposta ou raciocínio. Entre um passo e o seguinte,
// 12px, como no desktop (o fio atravessa esse espaço até a próxima bolinha).
export function Step({ dot, connect, children }: { dot: string; connect: boolean; children: ReactNode }) {
  return (
    <div className="relative pb-3 pl-4">
      {connect && <span className="absolute top-[20px] -bottom-[9px] left-[3px] w-px bg-line" />}
      <span className={`absolute top-[11px] left-0 size-[7px] rounded-full ${dot}`} />
      {children}
    </div>
  );
}
