import { describe, expect, it } from 'vitest';
import { SEP } from '../../platform';
import type { CanvasNode } from '../types';
import { relocateFolder } from './relocate';

// "Localizar pasta…": o card, os terminais e as conversas da pasta antiga apontam para a nova.

const at = { x: 0, y: 0 };
const project = (id: string, path: string, extra: object = {}) => ({ id, type: 'project', position: at, data: { name: 'proj', path, color: '#fff', ...extra } }) as CanvasNode;
const terminal = (id: string, path: string, extra: object = {}) => ({ id, type: 'terminal', position: at, data: { name: 't', path, ...extra } }) as CanvasNode;
const note = (id: string) => ({ id, type: 'note', position: at, data: { text: 'x' } }) as CanvasNode;
const pathOf = (nodes: CanvasNode[], id: string) => (nodes.find((n) => n.id === id)!.data as { path: string }).path;
const nameOf = (nodes: CanvasNode[], id: string) => (nodes.find((n) => n.id === id)!.data as { name: string }).name;

describe('relocateFolder', () => {
  it('troca o caminho do card e dos blocos abertos nele, e só deles', () => {
    const nodes = [project('p', '~/proj'), terminal('t', '~/proj'), terminal('o', '~/other'), note('n')];
    const next = relocateFolder(nodes, '~/proj', '~/renamed');
    expect(pathOf(next, 'p')).toBe('~/renamed');
    expect(pathOf(next, 't')).toBe('~/renamed');
    expect(pathOf(next, 'o')).toBe('~/other');
  });

  it('o card com o nome da pasta ganha o nome novo; nome escolhido fica', () => {
    const next = relocateFolder([project('a', '~/proj'), project('b', '~/proj', { name: 'Meu app' })], '~/proj', '~/renamed');
    expect(nameOf(next, 'a')).toBe('renamed');
    expect(nameOf(next, 'b')).toBe('Meu app');
  });

  it('tarefa isolada, espaço de trabalho e terminal de workspace ficam como estão', () => {
    const nodes = [
      project('w', '~/proj', { worktree: { of: 'x', base: 'main' } }),
      project('s', '~/proj', { folders: ['~/a'] }),
      terminal('t', '~/proj', { folders: ['~/a'] }),
    ];
    expect(relocateFolder(nodes, '~/proj', '~/renamed')).toBe(nodes);
  });

  it('caminho completo ou com ~ é a mesma pasta', () => {
    const home = window.api.homeDir;
    const next = relocateFolder([project('p', '~/proj')], `${home}/proj`, `${home}/renamed`);
    // Com a barra do sistema: no Windows, "~\renamed".
    expect(pathOf(next, 'p')).toBe(`~${SEP}renamed`);
  });
});
