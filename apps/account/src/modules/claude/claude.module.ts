import { Router } from 'express';

import { badRequest, tooLarge } from '../../errors';
import { currentUser } from '../../middlewares/requireAuth';
import type { ApiModule } from '../types';
import { parseFiles, parsePaths } from './claude.rules';
import { listFiles, readFiles, removeFiles, writeFiles } from './claude.service';

// Instruções e skills dos agentes na conta: CLAUDE.md, skills, agentes e comandos do Claude; AGENTS.md
// e skills do Codex; GEMINI.md e comandos do Gemini; comandos e skills do Cursor (ver claude.rules.ts).
// GET /api/claude: a lista, com o hash de cada um (sem o conteúdo).
// POST /api/claude/read { paths }: o conteúdo dos pedidos.
// PUT /api/claude { files: [{ path, content }] }: grava a versão nova.
// POST /api/claude/remove { paths }: tira da conta ("Tirar da conta" no Perfil).
export const claudeModule: ApiModule = ({ db, authed }) => {
  const router = Router();

  router.get('/claude', authed, async (req, res) => {
    res.json({ files: await listFiles(db, currentUser(req).id) });
  });

  router.post('/claude/read', authed, async (req, res) => {
    const paths = parsePaths(req.body);
    if (typeof paths === 'string') throw badRequest(paths);
    res.json({ files: await readFiles(db, currentUser(req).id, paths) });
  });

  router.put('/claude', authed, async (req, res) => {
    const files = parseFiles(req.body);
    if (files === 'too large') throw tooLarge('Arquivo grande demais para a conta.');
    if (typeof files === 'string') throw badRequest(files);
    if (!(await writeFiles(db, currentUser(req).id, files))) throw tooLarge('A conta chegou ao limite de arquivos do Claude.');
    res.status(204).end();
  });

  router.post('/claude/remove', authed, async (req, res) => {
    const paths = parsePaths(req.body);
    if (typeof paths === 'string') throw badRequest(paths);
    await removeFiles(db, currentUser(req).id, paths);
    res.status(204).end();
  });

  return router;
};
