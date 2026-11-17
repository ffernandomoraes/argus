import { describe, expect, it } from 'vitest';
import { editorUrl } from './openInEditor';

// Link que abre o arquivo no VS Code ou no Cursor, na linha.

describe('editorUrl', () => {
  it('Mac e Linux', () => {
    expect(editorUrl('vscode', '/Users/ana/meu projeto/a.ts', 42)).toBe('vscode://file/Users/ana/meu%20projeto/a.ts:42');
  });

  it('Windows: barras normais e a unidade depois da barra', () => {
    expect(editorUrl('cursor', 'C:\\Users\\ana\\a.ts')).toBe('cursor://file/C:/Users/ana/a.ts');
  });

  it('pasta do WSL: pela extensão de WSL do editor', () => {
    expect(editorUrl('vscode', '\\\\wsl.localhost\\Ubuntu\\home\\ana\\a.ts', 3)).toBe('vscode://vscode-remote/wsl+Ubuntu/home/ana/a.ts:3');
  });
});
